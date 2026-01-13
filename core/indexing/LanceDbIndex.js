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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanceDbIndex = void 0;
const uuid_1 = require("uuid");
const util_1 = require("../config/util");
const paths_1 = require("../util/paths");
const uri_1 = require("../util/uri");
const basic_js_1 = require("./chunk/basic.js");
const chunk_js_1 = require("./chunk/chunk.js");
const refreshIndex_js_1 = require("./refreshIndex.js");
const types_1 = require("./types");
const utils_1 = require("./utils");
class LanceDbIndex {
    get artifactId() {
        return `vectordb::${this.embeddingsProvider?.embeddingId}`;
    }
    /**
     * Factory method for creating LanceDbIndex instances.
     *
     * We dynamically import LanceDB only when supported to avoid native module loading errors
     * on incompatible platforms. LanceDB has CPU-specific native dependencies that can crash
     * the application if loaded on unsupported architectures.
     *
     * See isSupportedLanceDbCpuTargetForLinux() for platform compatibility details.
     */
    static async create(embeddingsProvider, readFile) {
        if (!(0, util_1.isSupportedLanceDbCpuTargetForLinux)()) {
            return null;
        }
        try {
            this.lance = await Promise.resolve().then(() => __importStar(require("vectordb")));
            return new LanceDbIndex(embeddingsProvider, readFile);
        }
        catch (err) {
            console.error("Failed to load LanceDB:", err);
            return null;
        }
    }
    constructor(embeddingsProvider, readFile) {
        this.embeddingsProvider = embeddingsProvider;
        this.readFile = readFile;
        this.relativeExpectedTime = 13;
        if (!LanceDbIndex.lance) {
            throw new Error("LanceDB not initialized");
        }
    }
    tableNameForTag(tag) {
        return (0, utils_1.tagToString)(tag).replace(/[^\w-_.]/g, "");
    }
    async createSqliteCacheTable(db) {
        await db.exec(`CREATE TABLE IF NOT EXISTS lance_db_cache (
        uuid TEXT PRIMARY KEY,
        cacheKey TEXT NOT NULL,
        path TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        vector TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        contents TEXT NOT NULL
    )`);
        await new Promise((resolve) => {
            void (0, paths_1.migrate)("lancedb_sqlite_artifact_id_column", async () => {
                try {
                    const pragma = await db.all("PRAGMA table_info(lance_db_cache)");
                    const hasArtifactIdCol = pragma.some((pragma) => pragma.name === "artifact_id");
                    if (!hasArtifactIdCol) {
                        await db.exec("ALTER TABLE lance_db_cache ADD COLUMN artifact_id TEXT NOT NULL DEFAULT 'UNDEFINED'");
                    }
                }
                finally {
                    resolve(undefined);
                }
            }, () => resolve(undefined));
        });
    }
    async computeRows(items) {
        const chunkMap = await this.collectChunks(items);
        const allChunks = Array.from(chunkMap.values()).flatMap(({ chunks }) => chunks);
        const embeddings = await this.getEmbeddings(allChunks);
        for (let i = embeddings.length - 1; i >= 0; i--) {
            if (embeddings[i] === undefined) {
                const chunk = allChunks[i];
                const chunks = chunkMap.get(chunk.filepath)?.chunks;
                if (chunks) {
                    const index = chunks.findIndex((c) => c === chunk);
                    if (index !== -1) {
                        chunks.splice(index, 1);
                    }
                }
                embeddings.splice(i, 1);
            }
        }
        return this.createLanceDbRows(chunkMap, embeddings);
    }
    async collectChunks(items) {
        const chunkMap = new Map();
        for (const item of items) {
            try {
                const content = await this.readFile(item.path);
                if (!(0, chunk_js_1.shouldChunk)(item.path, content)) {
                    continue;
                }
                const chunks = await this.getChunks(item, content);
                chunkMap.set(item.path, { item, chunks });
            }
            catch (err) {
                console.log(`LanceDBIndex, skipping ${item.path}: ${err}`);
            }
        }
        return chunkMap;
    }
    async getChunks(item, content) {
        if (!this.embeddingsProvider) {
            return [];
        }
        const chunks = [];
        const chunkParams = {
            filepath: item.path,
            contents: content,
            maxChunkSize: this.embeddingsProvider.maxEmbeddingChunkSize,
            digest: item.cacheKey,
        };
        for await (const chunk of (0, chunk_js_1.chunkDocument)(chunkParams)) {
            if (chunk.content.length === 0) {
                throw new Error("did not chunk properly");
            }
            chunks.push(chunk);
        }
        return chunks;
    }
    async getEmbeddings(chunks) {
        if (!this.embeddingsProvider) {
            return [];
        }
        try {
            return await this.embeddingsProvider.embed(chunks.map((c) => c.content));
        }
        catch (err) {
            throw new Error(`Failed to generate embeddings for ${chunks.length} chunks with provider: ${this.embeddingsProvider.embeddingId}: ${err}`, { cause: err });
        }
    }
    createLanceDbRows(chunkMap, embeddings) {
        const results = [];
        let embeddingIndex = 0;
        for (const [path, { item, chunks }] of chunkMap) {
            for (const chunk of chunks) {
                results.push({
                    path,
                    cachekey: item.cacheKey,
                    uuid: (0, uuid_1.v4)(),
                    vector: embeddings[embeddingIndex],
                    startLine: chunk.startLine,
                    endLine: chunk.endLine,
                    contents: chunk.content,
                });
                embeddingIndex++;
            }
        }
        return results;
    }
    /**
     * Due to a bug in indexing, some indexes have vectors
     * without the surrounding []. These would fail to parse
     * but this allows such existing indexes to function properly
     */
    parseVector(vector) {
        try {
            return JSON.parse(vector);
        }
        catch (err) {
            try {
                return JSON.parse(`[${vector}]`);
            }
            catch (err2) {
                throw new Error(`Failed to parse vector: ${vector}`, { cause: err2 });
            }
        }
    }
    async *update(tag, results, markComplete, repoName) {
        const lance = LanceDbIndex.lance;
        const sqliteDb = await refreshIndex_js_1.SqliteDb.get();
        await this.createSqliteCacheTable(sqliteDb);
        const lanceTableName = this.tableNameForTag(tag);
        const lanceDb = await lance.connect((0, paths_1.getLanceDbPath)());
        const existingLanceTables = await lanceDb.tableNames();
        let lanceTable = undefined;
        let needToCreateLanceTable = !existingLanceTables.includes(lanceTableName);
        const addComputedLanceDbRows = async (pathAndCacheKeys, computedRows) => {
            if (lanceTable) {
                if (computedRows.length > 0) {
                    await lanceTable.add(computedRows);
                }
            }
            else if (existingLanceTables.includes(lanceTableName)) {
                lanceTable = await lanceDb.openTable(lanceTableName);
                needToCreateLanceTable = false;
                if (computedRows.length > 0) {
                    await lanceTable.add(computedRows);
                }
            }
            else if (computedRows.length > 0) {
                lanceTable = await lanceDb.createTable(lanceTableName, computedRows);
                needToCreateLanceTable = false;
            }
            await markComplete(pathAndCacheKeys, types_1.IndexResultType.Compute);
        };
        yield {
            progress: 0,
            desc: `Computing embeddings for ${results.compute.length} ${this.formatListPlurality("file", results.compute.length)}`,
            status: "indexing",
        };
        const dbRows = await this.computeRows(results.compute);
        await this.insertRows(sqliteDb, dbRows);
        await addComputedLanceDbRows(results.compute, dbRows);
        let accumulatedProgress = 0;
        for (const { path, cacheKey } of results.addTag) {
            const stmt = await sqliteDb.prepare("SELECT * FROM lance_db_cache WHERE cacheKey = ? AND artifact_id = ?", cacheKey, this.artifactId);
            const cachedItems = await stmt.all();
            const lanceRows = [];
            for (const item of cachedItems) {
                try {
                    const vector = this.parseVector(item.vector);
                    const { uuid, startLine, endLine, contents } = item;
                    lanceRows.push({
                        path,
                        uuid,
                        startLine,
                        endLine,
                        contents,
                        cachekey: cacheKey,
                        vector,
                    });
                }
                catch (err) {
                    console.warn(`LanceDBIndex, skipping ${item.path} due to invalid vector JSON:\n${item.vector}\n\nError: ${err}`);
                }
            }
            if (lanceRows.length > 0) {
                if (needToCreateLanceTable) {
                    lanceTable = await lanceDb.createTable(lanceTableName, lanceRows);
                    needToCreateLanceTable = false;
                }
                else if (!lanceTable) {
                    lanceTable = await lanceDb.openTable(lanceTableName);
                    needToCreateLanceTable = false;
                    await lanceTable.add(lanceRows);
                }
                else {
                    await lanceTable?.add(lanceRows);
                }
            }
            await markComplete([{ path, cacheKey }], types_1.IndexResultType.AddTag);
            accumulatedProgress += 1 / results.addTag.length / 3;
            yield {
                progress: accumulatedProgress,
                desc: `Indexing ${(0, uri_1.getUriPathBasename)(path)}`,
                status: "indexing",
            };
        }
        if (!needToCreateLanceTable) {
            const toDel = [...results.removeTag, ...results.del];
            if (!lanceTable) {
                lanceTable = await lanceDb.openTable(lanceTableName);
            }
            for (const { path, cacheKey } of toDel) {
                await lanceTable.delete(`cachekey = '${cacheKey}' AND path = '${path}'`);
                accumulatedProgress += 1 / toDel.length / 3;
                yield {
                    progress: accumulatedProgress,
                    desc: `Stashing ${(0, uri_1.getUriPathBasename)(path)}`,
                    status: "indexing",
                };
            }
        }
        await markComplete(results.removeTag, types_1.IndexResultType.RemoveTag);
        for (const { path, cacheKey } of results.del) {
            await sqliteDb.run("DELETE FROM lance_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?", cacheKey, path, this.artifactId);
            accumulatedProgress += 1 / results.del.length / 3;
            yield {
                progress: accumulatedProgress,
                desc: `Removing ${(0, uri_1.getUriPathBasename)(path)}`,
                status: "indexing",
            };
        }
        await markComplete(results.del, types_1.IndexResultType.Delete);
        yield {
            progress: 1,
            desc: "Completed Calculating Embeddings",
            status: "done",
        };
    }
    async _retrieveForTag(tag, n, directory, vector, db) {
        const tableName = this.tableNameForTag(tag);
        const tableNames = await db.tableNames();
        if (!tableNames.includes(tableName)) {
            console.warn("Table not found in LanceDB", tableName);
            return [];
        }
        const table = await db.openTable(tableName);
        let query = table.search(vector);
        if (directory) {
            query = query.where(`path LIKE '${directory}%'`).limit(300);
        }
        else {
            query = query.limit(n);
        }
        const results = await query.execute();
        return results.slice(0, n);
    }
    async retrieve(query, n, tags, filterDirectory) {
        const lance = LanceDbIndex.lance;
        if (!this.embeddingsProvider) {
            return [];
        }
        // Use just the first chunk of the user query in case it is too long
        const chunks = [];
        for await (const chunk of (0, basic_js_1.basicChunker)(query, this.embeddingsProvider.maxEmbeddingChunkSize)) {
            chunks.push(chunk);
        }
        let vector = null;
        try {
            [vector] = await this.embeddingsProvider.embed(chunks.map((c) => c.content));
        }
        catch (err) {
            // If we fail to chunk, we just use what was happening before.
            [vector] = await this.embeddingsProvider.embed([query]);
        }
        const db = await lance.connect((0, paths_1.getLanceDbPath)());
        let allResults = [];
        for (const tag of tags) {
            const results = await this._retrieveForTag({ ...tag, artifactId: this.artifactId }, n, filterDirectory, vector, db);
            allResults.push(...results);
        }
        allResults = allResults
            .sort((a, b) => a._distance - b._distance)
            .slice(0, n);
        const sqliteDb = await refreshIndex_js_1.SqliteDb.get();
        const data = await sqliteDb.all(`SELECT * FROM lance_db_cache WHERE uuid in (${allResults
            .map((r) => `'${r.uuid}'`)
            .join(",")})`);
        return data.map((d) => {
            return {
                digest: d.cacheKey,
                filepath: d.path,
                startLine: d.startLine,
                endLine: d.endLine,
                index: 0,
                content: d.contents,
            };
        });
    }
    async insertRows(db, rows) {
        return new Promise((resolve, reject) => {
            db.db.serialize(() => {
                db.db.exec("BEGIN", (err) => {
                    if (err) {
                        reject(new Error("error creating transaction", { cause: err }));
                    }
                });
                const sql = "INSERT INTO lance_db_cache (uuid, cacheKey, path, artifact_id, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                rows.map((r) => {
                    db.db.run(sql, [
                        r.uuid,
                        r.cachekey,
                        r.path,
                        this.artifactId,
                        JSON.stringify(r.vector),
                        r.startLine,
                        r.endLine,
                        r.contents,
                    ], (result, err) => {
                        if (err) {
                            reject(new Error("error inserting into lance_db_cache table", {
                                cause: err,
                            }));
                        }
                    });
                });
                db.db.exec("COMMIT", (err) => {
                    if (err) {
                        reject(new Error("error while committing insert into lance_db_rows transaction", { cause: err }));
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    formatListPlurality(word, length) {
        return length <= 1 ? word : `${word}s`;
    }
}
exports.LanceDbIndex = LanceDbIndex;
LanceDbIndex.lance = null;
//# sourceMappingURL=LanceDbIndex.js.map