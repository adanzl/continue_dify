"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutocompleteLruCache = void 0;
const async_mutex_1 = require("async-mutex");
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
const refreshIndex_js_1 = require("../../indexing/refreshIndex.js");
const paths_js_1 = require("../../util/paths.js");
/**
 * LRU cache for autocomplete results with SQLite persistence.
 *
 * Implements a least-recently-used cache that:
 * - Stores prefix-to-completion mappings in memory
 * - Periodically flushes changes to SQLite for persistence
 * - Evicts oldest entries when capacity is exceeded
 * - Supports prefix matching for flexible autocomplete retrieval
 */
class AutocompleteLruCache {
    constructor(db) {
        this.db = db;
        this.mutex = new async_mutex_1.Mutex();
        this.cache = new Map();
        this.dirty = new Set();
    }
    /**
     * Singleton accessor that initializes the cache with SQLite persistence.
     * Creates the database table if it doesn't exist and loads existing entries.
     */
    static async get() {
        if (!AutocompleteLruCache.instancePromise) {
            AutocompleteLruCache.instancePromise = (async () => {
                const db = await (0, sqlite_1.open)({
                    filename: (0, paths_js_1.getTabAutocompleteCacheSqlitePath)(),
                    driver: sqlite3_1.default.Database,
                });
                await db.exec("PRAGMA busy_timeout = 3000;");
                await db.run(`
          CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            timestamp INTEGER NOT NULL
          )
        `);
                const instance = new AutocompleteLruCache(db);
                await instance.loadFromDb();
                instance.startFlushTimer();
                return instance;
            })();
        }
        return AutocompleteLruCache.instancePromise;
    }
    /** Loads all cached entries from SQLite into memory on initialization. */
    async loadFromDb() {
        const rows = await this.db.all("SELECT key, value, timestamp FROM cache");
        for (const row of rows) {
            this.cache.set(row.key, {
                value: row.value,
                timestamp: row.timestamp,
            });
        }
    }
    /** Starts periodic flush timer to persist dirty entries to database. */
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush().catch((e) => console.error("Error flushing cache:", e));
        }, AutocompleteLruCache.flushInterval);
    }
    /**
     * Retrieves cached completion for a prefix using longest-match strategy.
     *
     * Algorithm:
     * 1. Finds the longest cached prefix that the query starts with
     * 2. Validates that cached completion starts with the remaining query text
     * 3. Returns the completion with the matched portion stripped
     * 4. Updates the entry's timestamp (LRU tracking)
     *
     * @param prefix - The prefix to search for
     * @returns The completion string with prefix removed, or undefined if no match
     */
    async get(prefix) {
        const truncatedPrefix = (0, refreshIndex_js_1.truncateSqliteLikePattern)(prefix);
        let bestMatch = null;
        for (const [key, entry] of this.cache.entries()) {
            if (truncatedPrefix.startsWith(key)) {
                if (!bestMatch || key.length > bestMatch.key.length) {
                    bestMatch = { key, entry };
                }
            }
        }
        if (bestMatch &&
            bestMatch.entry.value.startsWith(truncatedPrefix.slice(bestMatch.key.length))) {
            bestMatch.entry.timestamp = Date.now();
            this.dirty.add(bestMatch.key);
            return bestMatch.entry.value.slice(truncatedPrefix.length - bestMatch.key.length);
        }
        return undefined;
    }
    /**
     * Stores a prefix-to-completion mapping in the cache.
     *
     * Thread-safe operation that:
     * - Truncates the prefix for SQLite pattern safety
     * - Updates or inserts the entry with current timestamp
     * - Evicts oldest entry if capacity exceeded
     * - Marks entry as dirty for next flush
     *
     * @param prefix - The prefix key
     * @param completion - The completion value to cache
     */
    async put(prefix, completion) {
        const release = await this.mutex.acquire();
        const truncatedPrefix = (0, refreshIndex_js_1.truncateSqliteLikePattern)(prefix);
        try {
            const now = Date.now();
            this.cache.set(truncatedPrefix, {
                value: completion,
                timestamp: now,
            });
            this.dirty.add(truncatedPrefix);
            if (this.cache.size > AutocompleteLruCache.capacity) {
                let oldestKey = null;
                let oldestTime = Infinity;
                for (const [key, entry] of this.cache.entries()) {
                    if (entry.timestamp < oldestTime) {
                        oldestTime = entry.timestamp;
                        oldestKey = key;
                    }
                }
                if (oldestKey) {
                    this.cache.delete(oldestKey);
                    this.dirty.add(oldestKey);
                }
            }
        }
        finally {
            release();
        }
    }
    /**
     * Persists all dirty entries to SQLite in a single transaction.
     *
     * Performs upserts for existing cache entries and deletes for evicted entries.
     * Skips if no changes pending. Rolls back transaction on error.
     */
    async flush() {
        if (this.dirty.size === 0)
            return;
        const release = await this.mutex.acquire();
        const dirtyKeys = Array.from(this.dirty);
        this.dirty.clear();
        try {
            await this.db.run("BEGIN TRANSACTION");
            for (const key of dirtyKeys) {
                const entry = this.cache.get(key);
                if (entry) {
                    // Upsert
                    await this.db.run(`INSERT INTO cache (key, value, timestamp) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = ?, timestamp = ?`, key, entry.value, entry.timestamp, entry.value, entry.timestamp);
                }
                else {
                    // Delete
                    await this.db.run("DELETE FROM cache WHERE key = ?", key);
                }
            }
            await this.db.run("COMMIT");
        }
        catch (error) {
            await this.db.run("ROLLBACK");
            console.error("Error flushing cache:", error);
        }
        finally {
            release();
        }
    }
    /**
     * Gracefully shuts down the cache.
     * Stops the flush timer, persists pending changes, and closes database connection.
     */
    async close() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.flush();
        await this.db.close();
        AutocompleteLruCache.instancePromise = undefined;
    }
}
exports.AutocompleteLruCache = AutocompleteLruCache;
AutocompleteLruCache.capacity = 1000;
AutocompleteLruCache.flushInterval = 30000;
exports.default = AutocompleteLruCache;
//# sourceMappingURL=AutocompleteLruCache.js.map