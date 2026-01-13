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
exports.ChunkCodebaseIndex = void 0;
const path = __importStar(require("path"));
const refreshIndex_js_1 = require("../refreshIndex.js");
const types_js_1 = require("../types.js");
const uri_js_1 = require("../../util/uri.js");
const utils_js_1 = require("../utils.js");
const chunk_js_1 = require("./chunk.js");
class ChunkCodebaseIndex {
    constructor(readFile, continueServerClient, maxChunkSize) {
        this.readFile = readFile;
        this.continueServerClient = continueServerClient;
        this.maxChunkSize = maxChunkSize;
        this.relativeExpectedTime = 1;
        this.artifactId = ChunkCodebaseIndex.artifactId;
    }
    async *update(tag, results, markComplete, repoName) {
        const db = await refreshIndex_js_1.SqliteDb.get();
        await this.createTables(db);
        const tagString = (0, utils_js_1.tagToString)(tag);
        // Check the remote cache
        if (this.continueServerClient.connected) {
            try {
                const keys = results.compute.map(({ cacheKey }) => cacheKey);
                const resp = await this.continueServerClient.getFromIndexCache(keys, "chunks", repoName);
                for (const [cacheKey, chunks] of Object.entries(resp.files)) {
                    await this.insertChunks(db, tagString, chunks);
                }
                results.compute = results.compute.filter((item) => !resp.files[item.cacheKey]);
            }
            catch (e) {
                console.error("Failed to fetch from remote cache: ", e);
            }
        }
        let accumulatedProgress = 0;
        if (results.compute.length > 0) {
            const filepath = results.compute[0].path;
            const folderName = path.basename(path.dirname(filepath));
            yield {
                desc: `Chunking files in ${folderName}`,
                status: "indexing",
                progress: accumulatedProgress,
            };
            const chunks = await this.computeChunks(results.compute);
            await this.insertChunks(db, tagString, chunks);
            await markComplete(results.compute, types_js_1.IndexResultType.Compute);
        }
        // Add tag
        for (const item of results.addTag) {
            try {
                await db.run(`
          INSERT INTO chunk_tags (chunkId, tag)
          SELECT id, ? FROM chunks
          WHERE cacheKey = ?
        `, [tagString, item.cacheKey]);
            }
            catch (e) {
                if (!e.message.includes("UNIQUE constraint")) {
                    // Throw any errors other than duplicate tag
                    // Possible the changes were already added by another instance of the extension
                    // For example vscode running side by side with intellij
                    throw e;
                }
            }
            await markComplete([item], types_js_1.IndexResultType.AddTag);
            accumulatedProgress += 1 / results.addTag.length / 4;
            yield {
                progress: accumulatedProgress,
                desc: `Adding ${(0, uri_js_1.getUriPathBasename)(item.path)}`,
                status: "indexing",
            };
        }
        // Remove tag
        for (const item of results.removeTag) {
            await db.run(`
        DELETE FROM chunk_tags
        WHERE tag = ?
          AND chunkId IN (
            SELECT id FROM chunks
            WHERE cacheKey = ? AND path = ?
          )
      `, [tagString, item.cacheKey, item.path]);
            await markComplete([item], types_js_1.IndexResultType.RemoveTag);
            accumulatedProgress += 1 / results.removeTag.length / 4;
            yield {
                progress: accumulatedProgress,
                desc: `Removing ${(0, uri_js_1.getUriPathBasename)(item.path)}`,
                status: "indexing",
            };
        }
        // Delete
        for (const item of results.del) {
            const chunkToDelete = await db.get("SELECT id FROM chunks WHERE cacheKey = ?", [item.cacheKey]);
            if (chunkToDelete) {
                await db.run("DELETE FROM chunks WHERE id = ?", [chunkToDelete.id]);
                // Delete from chunk_tags
                await db.run("DELETE FROM chunk_tags WHERE chunkId = ?", [
                    chunkToDelete.id,
                ]);
            }
            else {
                console.debug("Chunk to delete wasn't found in the table: ", item.path);
            }
            await markComplete([item], types_js_1.IndexResultType.Delete);
            accumulatedProgress += 1 / results.del.length / 4;
            yield {
                progress: accumulatedProgress,
                desc: `Removing ${(0, uri_js_1.getUriPathBasename)(item.path)}`,
                status: "indexing",
            };
        }
    }
    async createTables(db) {
        await db.exec(`CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cacheKey TEXT NOT NULL,
      path TEXT NOT NULL,
      idx INTEGER NOT NULL,
      startLine INTEGER NOT NULL,
      endLine INTEGER NOT NULL,
      content TEXT NOT NULL
    )`);
        await db.exec(`CREATE TABLE IF NOT EXISTS chunk_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        chunkId INTEGER NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks (id),
        UNIQUE (tag, chunkId)
    )`);
    }
    async packToChunks(pack) {
        const contents = await this.readFile(pack.path);
        if (!(0, chunk_js_1.shouldChunk)(pack.path, contents)) {
            return [];
        }
        const chunks = [];
        const chunkParams = {
            filepath: pack.path,
            contents,
            maxChunkSize: this.maxChunkSize,
            digest: pack.cacheKey,
        };
        for await (const c of (0, chunk_js_1.chunkDocument)(chunkParams)) {
            chunks.push(c);
        }
        return chunks;
    }
    async computeChunks(paths) {
        const chunkLists = await Promise.all(paths.map((p) => this.packToChunks(p)));
        return chunkLists.flat();
    }
    async insertChunks(db, tagString, chunks) {
        await new Promise((resolve, reject) => {
            db.db.serialize(() => {
                db.db.exec("BEGIN", (err) => {
                    if (err) {
                        reject(new Error("error creating transaction", { cause: err }));
                    }
                });
                const chunksSQL = "INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES (?, ?, ?, ?, ?, ?)";
                chunks.map((c) => {
                    db.db.run(chunksSQL, [c.digest, c.filepath, c.index, c.startLine, c.endLine, c.content], (result, err) => {
                        if (err) {
                            reject(new Error("error inserting into chunks table", {
                                cause: err,
                            }));
                        }
                    });
                    const chunkTagsSQL = "INSERT INTO chunk_tags (chunkId, tag) VALUES (last_insert_rowid(), ?)";
                    db.db.run(chunkTagsSQL, [tagString], (result, err) => {
                        if (err) {
                            reject(new Error("error inserting into chunk_tags table", {
                                cause: err,
                            }));
                        }
                    });
                });
                db.db.exec("COMMIT", (err) => {
                    if (err) {
                        reject(new Error("error while committing insert chunks transaction", {
                            cause: err,
                        }));
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
}
exports.ChunkCodebaseIndex = ChunkCodebaseIndex;
ChunkCodebaseIndex.artifactId = "chunks";
//# sourceMappingURL=ChunkCodebaseIndex.js.map