"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexLock = exports.GlobalCacheCodeBaseIndex = exports.SqliteDb = void 0;
exports.getComputeDeleteAddRemove = getComputeDeleteAddRemove;
exports.truncateToLastNBytes = truncateToLastNBytes;
exports.truncateSqliteLikePattern = truncateSqliteLikePattern;
const node_crypto_1 = __importDefault(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const p_limit_1 = __importDefault(require("p-limit"));
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
const paths_js_1 = require("../util/paths.js");
class SqliteDb {
    static async createTables(db) {
        await db.exec("PRAGMA journal_mode=WAL;");
        await db.exec(`CREATE TABLE IF NOT EXISTS tag_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL,
            path STRING NOT NULL,
            cacheKey STRING NOT NULL,
            lastUpdated INTEGER NOT NULL
        )`);
        await db.exec(`CREATE TABLE IF NOT EXISTS global_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cacheKey STRING NOT NULL,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL
        )`);
        await db.exec(`CREATE TABLE IF NOT EXISTS indexing_lock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            locked BOOLEAN NOT NULL,
            timestamp INTEGER NOT NULL,
            dirs STRING NOT NULL
        )`);
        // Delete duplicate rows from tag_catalog
        await db.exec(`
    DELETE FROM tag_catalog
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM tag_catalog
      GROUP BY dir, branch, artifactId, path, cacheKey
    )
  `);
        // Delete duplicate rows from global_cache
        await db.exec(`
    DELETE FROM global_cache
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM global_cache
      GROUP BY cacheKey, dir, branch, artifactId
    )
  `);
        // Add unique constraints if they don't exist
        await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_catalog_unique 
     ON tag_catalog(dir, branch, artifactId, path, cacheKey)`);
        await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_global_cache_unique 
     ON global_cache(cacheKey, dir, branch, artifactId)`);
    }
    static async get() {
        if (SqliteDb.db && fs.existsSync(SqliteDb.indexSqlitePath)) {
            return SqliteDb.db;
        }
        SqliteDb.indexSqlitePath = (0, paths_js_1.getIndexSqlitePath)();
        SqliteDb.db = await (0, sqlite_1.open)({
            filename: SqliteDb.indexSqlitePath,
            driver: sqlite3_1.default.Database,
        });
        await SqliteDb.db.exec("PRAGMA busy_timeout = 3000;");
        await SqliteDb.createTables(SqliteDb.db);
        return SqliteDb.db;
    }
}
exports.SqliteDb = SqliteDb;
SqliteDb.db = null;
SqliteDb.indexSqlitePath = (0, paths_js_1.getIndexSqlitePath)();
async function getSavedItemsForTag(tag) {
    const db = await SqliteDb.get();
    const stmt = await db.prepare(`SELECT path, cacheKey, lastUpdated FROM tag_catalog
    WHERE dir = ? AND branch = ? AND artifactId = ?`, tag.directory, tag.branch, tag.artifactId);
    const rows = await stmt.all();
    return rows;
}
var AddRemoveResultType;
(function (AddRemoveResultType) {
    AddRemoveResultType["Add"] = "add";
    AddRemoveResultType["Remove"] = "remove";
    AddRemoveResultType["UpdateNewVersion"] = "updateNewVersion";
    AddRemoveResultType["UpdateOldVersion"] = "updateOldVersion";
    AddRemoveResultType["UpdateLastUpdated"] = "updateLastUpdated";
    AddRemoveResultType["Compute"] = "compute";
})(AddRemoveResultType || (AddRemoveResultType = {}));
// Don't attempt to index anything over 5MB
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
async function getAddRemoveForTag(tag, currentFiles, readFile) {
    const newLastUpdatedTimestamp = Date.now();
    const files = { ...currentFiles };
    for (const path in files) {
        if (files[path].size > MAX_FILE_SIZE_BYTES) {
            delete files[path];
        }
    }
    const saved = await getSavedItemsForTag(tag);
    const updateNewVersion = [];
    const updateOldVersion = [];
    const remove = [];
    const updateLastUpdated = [];
    // First, group items by path and find latest timestamp for each
    const pathGroups = new Map();
    for (const item of saved) {
        const { lastUpdated, path, cacheKey } = item;
        if (!pathGroups.has(path)) {
            pathGroups.set(path, {
                latest: { lastUpdated, cacheKey },
                allVersions: [{ cacheKey }],
            });
        }
        else {
            const group = pathGroups.get(path);
            group.allVersions.push({ cacheKey });
            if (lastUpdated > group.latest.lastUpdated) {
                group.latest = { lastUpdated, cacheKey };
            }
        }
    }
    // Now process each unique path
    for (const [path, group] of pathGroups) {
        if (files[path] === undefined) {
            // Was indexed, but no longer exists. Remove all versions
            for (const version of group.allVersions) {
                remove.push({ path, cacheKey: version.cacheKey });
            }
        }
        else {
            // Exists in old and new, so determine whether it was updated
            if (group.latest.lastUpdated < files[path].lastModified) {
                // Change was made after last update
                const newHash = calculateHash(await readFile(path));
                if (group.latest.cacheKey !== newHash) {
                    updateNewVersion.push({
                        path,
                        cacheKey: newHash,
                    });
                    for (const version of group.allVersions) {
                        updateOldVersion.push({ path, cacheKey: version.cacheKey });
                    }
                }
                else {
                    // File contents did not change
                    updateLastUpdated.push({ path, cacheKey: group.latest.cacheKey });
                    for (const version of group.allVersions) {
                        if (version.cacheKey !== group.latest.cacheKey) {
                            updateOldVersion.push({ path, cacheKey: version.cacheKey });
                        }
                    }
                }
            }
            else {
                // Already updated, do nothing
            }
            // Remove path, so that only newly created paths remain
            delete files[path];
        }
    }
    // limit to only 10 concurrent file reads to avoid issues such as
    // "too many file handles". A large number here does not improve
    // throughput due to the nature of disk or network i/o -- huge
    // amounts of readers generally does not improve performance
    const limit = (0, p_limit_1.default)(10);
    const promises = Object.keys(files).map(async (path) => {
        const fileContents = await limit(() => readFile(path));
        return { path, cacheKey: calculateHash(fileContents) };
    });
    const add = await Promise.all(promises);
    // Create the markComplete callback function
    const db = await SqliteDb.get();
    const itemToAction = {
        [AddRemoveResultType.Add]: [],
        [AddRemoveResultType.Remove]: [],
        [AddRemoveResultType.UpdateNewVersion]: [],
        [AddRemoveResultType.UpdateOldVersion]: [],
        [AddRemoveResultType.UpdateLastUpdated]: [],
        [AddRemoveResultType.Compute]: [],
    };
    async function markComplete(items, resultType) {
        const addRemoveResultType = mapIndexResultTypeToAddRemoveResultType(resultType);
        const actionItems = itemToAction[addRemoveResultType];
        if (!actionItems) {
            console.warn(`No action items found for result type: ${resultType}`);
            return;
        }
        for (const item of items) {
            const { path, cacheKey } = item;
            switch (addRemoveResultType) {
                case AddRemoveResultType.Compute:
                    await db.run("REPLACE INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)", path, cacheKey, newLastUpdatedTimestamp, tag.directory, tag.branch, tag.artifactId);
                    break;
                case AddRemoveResultType.Add:
                    await db.run("REPLACE INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)", path, cacheKey, newLastUpdatedTimestamp, tag.directory, tag.branch, tag.artifactId);
                    break;
                case AddRemoveResultType.Remove:
                    await db.run(`DELETE FROM tag_catalog WHERE
              cacheKey = ? AND
              path = ? AND
              dir = ? AND
              branch = ? AND
              artifactId = ?
          `, cacheKey, path, tag.directory, tag.branch, tag.artifactId);
                    break;
                case AddRemoveResultType.UpdateLastUpdated:
                case AddRemoveResultType.UpdateNewVersion:
                    await db.run(`UPDATE tag_catalog SET
                cacheKey = ?,
                lastUpdated = ?
             WHERE
                path = ? AND
                dir = ? AND
                branch = ? AND
                artifactId = ?
            `, cacheKey, newLastUpdatedTimestamp, path, tag.directory, tag.branch, tag.artifactId);
                    break;
                case AddRemoveResultType.UpdateOldVersion:
                    break;
            }
        }
    }
    for (const item of updateNewVersion) {
        itemToAction[AddRemoveResultType.UpdateNewVersion].push(item);
    }
    for (const item of add) {
        itemToAction[AddRemoveResultType.Add].push(item);
    }
    for (const item of updateOldVersion) {
        itemToAction[AddRemoveResultType.UpdateOldVersion].push(item);
    }
    for (const item of remove) {
        itemToAction[AddRemoveResultType.Remove].push(item);
    }
    return [
        [...add, ...updateNewVersion],
        [...remove, ...updateOldVersion],
        updateLastUpdated,
        markComplete,
    ];
}
/**
 * Check the global cache for items with this cacheKey for the given artifactId.
 * Return all of the tags that it exists under, which could be an empty array
 */
async function getTagsFromGlobalCache(cacheKey, artifactId) {
    const db = await SqliteDb.get();
    const stmt = await db.prepare("SELECT dir, branch, artifactId FROM global_cache WHERE cacheKey = ? AND artifactId = ?");
    const rows = await stmt.all(cacheKey, artifactId);
    return rows;
}
function calculateHash(fileContents) {
    const hash = node_crypto_1.default.createHash("sha256");
    hash.update(fileContents);
    return hash.digest("hex");
}
function mapIndexResultTypeToAddRemoveResultType(resultType) {
    switch (resultType) {
        case "updateLastUpdated":
            return AddRemoveResultType.UpdateLastUpdated;
        case "compute":
            return AddRemoveResultType.Compute;
        case "addTag":
            return AddRemoveResultType.Add;
        case "del":
        case "removeTag":
            return AddRemoveResultType.Remove;
        default:
            throw new Error(`Unexpected result type: ${resultType}`);
    }
}
async function getComputeDeleteAddRemove(tag, currentFiles, readFile, repoName) {
    const [add, remove, lastUpdated, markComplete] = await getAddRemoveForTag(tag, currentFiles, readFile);
    const compute = [];
    const del = [];
    const addTag = [];
    const removeTag = [];
    for (const { path, cacheKey } of add) {
        const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
        if (existingTags.length > 0) {
            addTag.push({ path, cacheKey });
        }
        else {
            compute.push({ path, cacheKey });
        }
    }
    for (const { path, cacheKey } of remove) {
        const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
        if (existingTags.length > 1) {
            removeTag.push({ path, cacheKey });
        }
        else {
            if (existingTags.length === 0) {
                // console.warn("Existing tags should not be empty when trying to remove");
            }
            del.push({ path, cacheKey });
        }
    }
    const results = {
        compute,
        del,
        addTag,
        removeTag,
    };
    const globalCacheIndex = await GlobalCacheCodeBaseIndex.create();
    return [
        results,
        lastUpdated,
        async (items, resultType) => {
            // Update tag catalog
            await markComplete(items, resultType);
            // Update the global cache
            const results = {
                compute: [],
                del: [],
                addTag: [],
                removeTag: [],
            };
            results[resultType] = items;
            for await (const _ of globalCacheIndex.update(tag, results, async () => { }, repoName)) {
            }
        },
    ];
}
class GlobalCacheCodeBaseIndex {
    constructor(db) {
        this.db = db;
        this.relativeExpectedTime = 1;
        this.artifactId = "globalCache";
    }
    static async create() {
        return new GlobalCacheCodeBaseIndex(await SqliteDb.get());
    }
    async *update(tag, results, _, repoName) {
        const add = [...results.compute, ...results.addTag];
        const remove = [...results.del, ...results.removeTag];
        await Promise.all([
            ...remove.map(({ cacheKey }) => {
                return this.deleteOrRemoveTag(cacheKey, tag);
            }),
            ...add.map(({ cacheKey }) => {
                return this.computeOrAddTag(cacheKey, tag);
            }),
        ]);
        yield { progress: 1, desc: "Done updating global cache", status: "done" };
    }
    async computeOrAddTag(cacheKey, tag) {
        await this.db.run("REPLACE INTO global_cache (cacheKey, dir, branch, artifactId) VALUES (?, ?, ?, ?)", cacheKey, tag.directory, tag.branch, tag.artifactId);
    }
    async deleteOrRemoveTag(cacheKey, tag) {
        await this.db.run("DELETE FROM global_cache WHERE cacheKey = ? AND dir = ? AND branch = ? AND artifactId = ?", cacheKey, tag.directory, tag.branch, tag.artifactId);
    }
}
exports.GlobalCacheCodeBaseIndex = GlobalCacheCodeBaseIndex;
const SQLITE_MAX_LIKE_PATTERN_LENGTH = 50000;
function truncateToLastNBytes(input, maxBytes) {
    let bytes = 0;
    let startIndex = 0;
    for (let i = input.length - 1; i >= 0; i--) {
        bytes += new TextEncoder().encode(input[i]).length;
        if (bytes > maxBytes) {
            startIndex = i + 1;
            break;
        }
    }
    return input.substring(startIndex, input.length);
}
function truncateSqliteLikePattern(input, safety = 100) {
    return truncateToLastNBytes(input, SQLITE_MAX_LIKE_PATTERN_LENGTH - safety);
}
class IndexLock {
    static getLockTableName() {
        return "indexing_lock";
    }
    static async isLocked() {
        const db = await SqliteDb.get();
        const row = (await db.get(`SELECT locked, dirs, timestamp FROM ${IndexLock.getLockTableName()} WHERE locked = ?`, true));
        return row;
    }
    static async lock(dirs) {
        const db = await SqliteDb.get();
        await db.run(`INSERT INTO ${IndexLock.getLockTableName()} (locked, timestamp, dirs) VALUES (?, ?, ?)`, true, Date.now(), dirs);
    }
    static async updateTimestamp() {
        const db = await SqliteDb.get();
        await db.run(`UPDATE ${IndexLock.getLockTableName()} SET timestamp = ? where locked = ?`, Date.now(), true);
    }
    static async unlock() {
        const db = await SqliteDb.get();
        await db.run(`DELETE FROM ${IndexLock.getLockTableName()} WHERE locked = ?`, true);
    }
}
exports.IndexLock = IndexLock;
//# sourceMappingURL=refreshIndex.js.map