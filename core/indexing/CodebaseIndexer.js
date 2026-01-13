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
exports.CodebaseIndexer = exports.PauseToken = void 0;
const fs = __importStar(require("fs/promises"));
const extractMinimalStackTraceInfo_js_1 = require("../util/extractMinimalStackTraceInfo.js");
const Logger_js_1 = require("../util/Logger.js");
const paths_js_1 = require("../util/paths.js");
const uri_js_1 = require("../util/uri.js");
const client_1 = require("../continueServer/stubs/client");
const index_js_1 = require("../llm/index.js");
const errors_js_1 = require("../util/errors.js");
const ChunkCodebaseIndex_js_1 = require("./chunk/ChunkCodebaseIndex.js");
const CodeSnippetsIndex_js_1 = require("./CodeSnippetsIndex.js");
const DocsService_js_1 = require("./docs/DocsService.js");
const FullTextSearchCodebaseIndex_js_1 = require("./FullTextSearchCodebaseIndex.js");
const LanceDbIndex_js_1 = require("./LanceDbIndex.js");
const refreshIndex_js_1 = require("./refreshIndex.js");
const types_js_1 = require("./types.js");
const walkDir_js_1 = require("./walkDir.js");
class PauseToken {
    constructor(_paused) {
        this._paused = _paused;
    }
    set paused(value) {
        this._paused = value;
    }
    get paused() {
        return this._paused;
    }
}
exports.PauseToken = PauseToken;
class CodebaseIndexer {
    getUserFriendlyIndexName(artifactId) {
        if (artifactId === FullTextSearchCodebaseIndex_js_1.FullTextSearchCodebaseIndex.artifactId)
            return "Full text search";
        if (artifactId === CodeSnippetsIndex_js_1.CodeSnippetsCodebaseIndex.artifactId)
            return "Code snippets";
        if (artifactId === ChunkCodebaseIndex_js_1.ChunkCodebaseIndex.artifactId)
            return "Chunking";
        if (artifactId.startsWith("vectordb"))
            return "Embedding";
        return artifactId; // fallback to original
    }
    constructor(configHandler, ide, messenger, initialPaused = false) {
        this.configHandler = configHandler;
        this.ide = ide;
        this.messenger = messenger;
        /**
         * We batch for two reasons:
         * - To limit memory usage for indexes that perform computations locally, e.g. FTS
         * - To make as few requests as possible to the embeddings providers
         */
        this.filesPerBatch = 200;
        this.builtIndexes = [];
        // Note that we exclude certain Sqlite errors that we do not want to clear the indexes on,
        // e.g. a `SQLITE_BUSY` error.
        this.errorsRegexesToClearIndexesOn = [
            /Invalid argument error: Values length (d+) is less than the length ((d+)) multiplied by the value size (d+)/,
            /SQLITE_CONSTRAINT/,
            /SQLITE_ERROR/,
            /SQLITE_CORRUPT/,
            /SQLITE_IOERR/,
            /SQLITE_FULL/,
        ];
        this.codebaseIndexingState = {
            status: "loading",
            desc: "loading",
            progress: 0,
        };
        // Initialize pause token
        this.pauseToken = new PauseToken(initialPaused);
        this.initPromise = this.init(configHandler);
        this.indexingCancellationController = new AbortController();
        this.indexingCancellationController.abort(); // initialize and abort so that a new one can be created
    }
    // Initialization - load config and attach config listener
    async init(configHandler) {
        const result = await configHandler.loadConfig();
        await this.handleConfigUpdate(result);
        configHandler.onConfigUpdate(this.handleConfigUpdate.bind(this));
    }
    set paused(value) {
        this.pauseToken.paused = value;
    }
    get paused() {
        return this.pauseToken.paused;
    }
    async clearIndexes() {
        const sqliteFilepath = (0, paths_js_1.getIndexSqlitePath)();
        const lanceDbFolder = (0, paths_js_1.getLanceDbPath)();
        try {
            await fs.unlink(sqliteFilepath);
        }
        catch (error) {
            // Capture indexer system failures to Sentry
            Logger_js_1.Logger.error(error, {
                filepath: sqliteFilepath,
            });
            console.error(`Error deleting ${sqliteFilepath} folder: ${error}`);
        }
        try {
            await fs.rm(lanceDbFolder, { recursive: true, force: true });
        }
        catch (error) {
            // Capture indexer system failures to Sentry
            Logger_js_1.Logger.error(error, {
                folderPath: lanceDbFolder,
            });
            console.error(`Error deleting ${lanceDbFolder}: ${error}`);
        }
    }
    async getIndexesToBuild() {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
            return [];
        }
        const embeddingsModel = config.selectedModelByRole.embed;
        if (!embeddingsModel) {
            return [];
        }
        const ideSettings = await this.ide.getIdeSettings();
        if (!ideSettings) {
            return [];
        }
        const continueServerClient = new client_1.ContinueServerClient(ideSettings.remoteConfigServerUrl, ideSettings.userToken);
        if (!continueServerClient) {
            return [];
        }
        const indexTypesToBuild = new Set(// use set to remove duplicates
        config.contextProviders
            .map((provider) => provider.description.dependsOnIndexing)
            .filter((indexType) => Array.isArray(indexType)) // remove undefined indexTypes
            .flat());
        const indexTypeToIndexerMapping = {
            chunk: async () => new ChunkCodebaseIndex_js_1.ChunkCodebaseIndex(this.ide.readFile.bind(this.ide), continueServerClient, embeddingsModel.maxEmbeddingChunkSize),
            codeSnippets: async () => new CodeSnippetsIndex_js_1.CodeSnippetsCodebaseIndex(this.ide),
            fullTextSearch: async () => new FullTextSearchCodebaseIndex_js_1.FullTextSearchCodebaseIndex(),
            embeddings: async () => {
                const lanceDbIndex = await LanceDbIndex_js_1.LanceDbIndex.create(embeddingsModel, this.ide.readFile.bind(this.ide));
                return lanceDbIndex;
            },
        };
        const indexes = [];
        // not parallelizing to avoid race conditions in sqlite
        for (const indexType of indexTypesToBuild) {
            if (indexType && indexType in indexTypeToIndexerMapping) {
                const index = await indexTypeToIndexerMapping[indexType]();
                if (index) {
                    indexes.push(index);
                }
            }
        }
        this.builtIndexes = indexes;
        return indexes;
    }
    totalIndexOps(results) {
        return (results.compute.length +
            results.del.length +
            results.addTag.length +
            results.removeTag.length);
    }
    singleFileIndexOps(results, lastUpdated, filePath) {
        const filterFn = (item) => item.path === filePath;
        const compute = results.compute.filter(filterFn);
        const del = results.del.filter(filterFn);
        const addTag = results.addTag.filter(filterFn);
        const removeTag = results.removeTag.filter(filterFn);
        const newResults = {
            compute,
            del,
            addTag,
            removeTag,
        };
        const newLastUpdated = lastUpdated.filter(filterFn);
        return [newResults, newLastUpdated];
    }
    async refreshFile(file, workspaceDirs) {
        if (this.pauseToken.paused) {
            // FIXME: by returning here, there is a chance that while paused a file is modified and
            // then after unpausing the file is not reindexed
            return;
        }
        const { foundInDir } = (0, uri_js_1.findUriInDirs)(file, workspaceDirs);
        if (!foundInDir) {
            return;
        }
        const branch = await this.ide.getBranch(foundInDir);
        const repoName = await this.ide.getRepoName(foundInDir);
        const indexesToBuild = await this.getIndexesToBuild();
        const stats = await this.ide.getFileStats([file]);
        const filePath = Object.keys(stats)[0];
        for (const index of indexesToBuild) {
            const tag = {
                directory: foundInDir,
                branch,
                artifactId: index.artifactId,
            };
            const [fullResults, fullLastUpdated, markComplete] = await (0, refreshIndex_js_1.getComputeDeleteAddRemove)(tag, { ...stats }, (filepath) => this.ide.readFile(filepath), repoName);
            const [results, lastUpdated] = this.singleFileIndexOps(fullResults, fullLastUpdated, filePath);
            // Don't update if nothing to update. Some of the indices might do unnecessary setup work
            if (this.totalIndexOps(results) + lastUpdated.length === 0) {
                continue;
            }
            for await (const _ of index.update(tag, results, markComplete, repoName)) {
            }
        }
    }
    async *refreshFiles(files) {
        let progress = 0;
        if (files.length === 0) {
            yield {
                progress: 1,
                desc: "Indexing Complete",
                status: "done",
            };
        }
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        const progressPer = 1 / files.length;
        try {
            for (const file of files) {
                yield {
                    progress,
                    desc: `Indexing file ${file}...`,
                    status: "indexing",
                };
                await this.refreshFile(file, workspaceDirs);
                progress += progressPer;
                if (this.pauseToken.paused) {
                    yield* this.yieldUpdateAndPause();
                }
            }
            yield {
                progress: 1,
                desc: "Indexing Complete",
                status: "done",
            };
        }
        catch (err) {
            yield this.handleErrorAndGetProgressUpdate(err);
        }
    }
    async *refreshDirs(dirs, abortSignal) {
        let progress = 0;
        if (dirs.length === 0) {
            yield {
                progress: 1,
                desc: "Nothing to index",
                status: "done",
            };
            return;
        }
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
            return;
        }
        if (config.disableIndexing) {
            yield {
                progress,
                desc: "Indexing is disabled",
                status: "disabled",
            };
            return;
        }
        else {
            yield {
                progress,
                desc: "Starting indexing",
                status: "loading",
            };
        }
        // Wait until Git Extension has loaded to report progress
        // so we don't appear stuck at 0% while waiting
        await this.ide.getRepoName(dirs[0]);
        yield {
            progress,
            desc: "Starting indexing...",
            status: "loading",
        };
        const beginTime = Date.now();
        let collectedWarnings = [];
        for (const directory of dirs) {
            const dirBasename = (0, uri_js_1.getUriPathBasename)(directory);
            yield {
                progress,
                desc: `Discovering files in ${dirBasename}...`,
                status: "indexing",
            };
            const directoryFiles = [];
            for await (const p of (0, walkDir_js_1.walkDirAsync)(directory, this.ide, {
                source: "codebase indexing: refresh dirs",
            })) {
                directoryFiles.push(p);
                if (abortSignal.aborted) {
                    yield {
                        progress: 0,
                        desc: "Indexing cancelled",
                        status: "cancelled",
                    };
                    return;
                }
                if (this.pauseToken.paused) {
                    yield* this.yieldUpdateAndPause();
                }
            }
            const branch = await this.ide.getBranch(directory);
            const repoName = await this.ide.getRepoName(directory);
            let nextLogThreshold = 0;
            for await (const updateDesc of this.indexFiles(directory, directoryFiles, branch, repoName)) {
                // Handle pausing in this loop because it's the only one really taking time
                if (abortSignal.aborted) {
                    yield {
                        progress: 0,
                        desc: "Indexing cancelled",
                        status: "cancelled",
                    };
                    return;
                }
                if (this.pauseToken.paused) {
                    yield* this.yieldUpdateAndPause();
                }
                // Collect warnings from indexFiles
                if (updateDesc.warnings && updateDesc.warnings.length > 0) {
                    collectedWarnings = [...updateDesc.warnings];
                }
                yield updateDesc;
                if (updateDesc.progress >= nextLogThreshold) {
                    // log progress every 2.5%
                    nextLogThreshold += 0.025;
                    this.logProgress(beginTime, Math.floor(directoryFiles.length * updateDesc.progress), updateDesc.progress);
                }
            }
        }
        // Final completion message with preserved warnings
        yield {
            progress: 1,
            desc: collectedWarnings.length > 0
                ? `Indexing completed with ${collectedWarnings.length} warning(s)`
                : "Indexing Complete",
            status: "done",
            warnings: collectedWarnings.length > 0 ? collectedWarnings : undefined,
        };
        this.logProgress(beginTime, 0, 1);
    }
    handleErrorAndGetProgressUpdate(err) {
        console.log("error when indexing: ", err);
        if (err instanceof Error) {
            const cause = (0, errors_js_1.getRootCause)(err);
            if (cause instanceof index_js_1.LLMError) {
                throw cause;
            }
            return this.errorToProgressUpdate(err);
        }
        return {
            progress: 0,
            desc: `Indexing failed: ${err}`,
            status: "failed",
            debugInfo: (0, extractMinimalStackTraceInfo_js_1.extractMinimalStackTraceInfo)(err?.stack),
        };
    }
    errorToProgressUpdate(err) {
        const cause = (0, errors_js_1.getRootCause)(err);
        let errMsg = `${cause}`;
        let shouldClearIndexes = false;
        // Check if any of the error regexes match
        for (const regexStr of this.errorsRegexesToClearIndexesOn) {
            const regex = new RegExp(regexStr);
            const match = err.message.match(regex);
            if (match !== null) {
                shouldClearIndexes = true;
                break;
            }
        }
        return {
            progress: 0,
            desc: errMsg,
            status: "failed",
            shouldClearIndexes,
            debugInfo: (0, extractMinimalStackTraceInfo_js_1.extractMinimalStackTraceInfo)(err.stack),
        };
    }
    logProgress(beginTime, completedFileCount, progress) {
        const timeTaken = Date.now() - beginTime;
        const seconds = Math.round(timeTaken / 1000);
        const progressPercentage = (progress * 100).toFixed(1);
        const filesPerSec = (completedFileCount / seconds).toFixed(2);
        // console.debug(
        //   `Indexing: ${progressPercentage}% complete, elapsed time: ${seconds}s, ${filesPerSec} file/sec`,
        // );
    }
    async *yieldUpdateAndPause() {
        yield {
            progress: 0,
            desc: "Indexing Paused",
            status: "paused",
        };
        while (this.pauseToken.paused) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    /*
     * Enables the indexing operation to be completed in batches, this is important in large
     * repositories where indexing can quickly use up all the memory available
     */
    *batchRefreshIndexResults(results) {
        let curPos = 0;
        while (curPos < results.compute.length ||
            curPos < results.del.length ||
            curPos < results.addTag.length ||
            curPos < results.removeTag.length) {
            yield {
                compute: results.compute.slice(curPos, curPos + this.filesPerBatch),
                del: results.del.slice(curPos, curPos + this.filesPerBatch),
                addTag: results.addTag.slice(curPos, curPos + this.filesPerBatch),
                removeTag: results.removeTag.slice(curPos, curPos + this.filesPerBatch),
            };
            curPos += this.filesPerBatch;
        }
    }
    async *indexFiles(directory, files, branch, repoName) {
        const stats = await this.ide.getFileStats(files);
        const indexesToBuild = await this.getIndexesToBuild();
        let completedIndexCount = 0;
        let progress = 0;
        const warnings = [];
        for (const codebaseIndex of indexesToBuild) {
            const tag = {
                directory,
                branch,
                artifactId: codebaseIndex.artifactId,
            };
            yield {
                progress: progress,
                desc: `Planning changes for ${codebaseIndex.artifactId} index...`,
                status: "indexing",
                warnings: warnings.length > 0 ? [...warnings] : undefined,
            };
            try {
                const [results, lastUpdated, markComplete] = await (0, refreshIndex_js_1.getComputeDeleteAddRemove)(tag, { ...stats }, (filepath) => this.ide.readFile(filepath), repoName);
                const totalOps = this.totalIndexOps(results);
                let completedOps = 0;
                // Don't update if nothing to update. Some of the indices might do unnecessary setup work
                if (totalOps > 0) {
                    for (const subResult of this.batchRefreshIndexResults(results)) {
                        try {
                            for await (const { desc } of codebaseIndex.update(tag, subResult, markComplete, repoName)) {
                                yield {
                                    progress,
                                    desc,
                                    status: "indexing",
                                    warnings: warnings.length > 0 ? [...warnings] : undefined,
                                };
                            }
                            completedOps +=
                                subResult.compute.length +
                                    subResult.del.length +
                                    subResult.addTag.length +
                                    subResult.removeTag.length;
                            progress =
                                (completedIndexCount + completedOps / totalOps) *
                                    (1 / indexesToBuild.length);
                        }
                        catch (err) {
                            // Collect non-fatal errors as warnings and continue
                            const warningMsg = err instanceof Error ? err.message : String(err);
                            const friendlyName = this.getUserFriendlyIndexName(codebaseIndex.artifactId);
                            warnings.push(`${friendlyName}: ${warningMsg}`);
                            console.warn(`${friendlyName}: ${warningMsg}`, err);
                            // Complete this batch and continue with next
                            completedOps +=
                                subResult.compute.length +
                                    subResult.del.length +
                                    subResult.addTag.length +
                                    subResult.removeTag.length;
                            progress =
                                (completedIndexCount + completedOps / totalOps) *
                                    (1 / indexesToBuild.length);
                        }
                    }
                }
                await markComplete(lastUpdated, types_js_1.IndexResultType.UpdateLastUpdated);
                completedIndexCount += 1;
            }
            catch (err) {
                // Handle errors during planning phase
                const cause = (0, errors_js_1.getRootCause)(err);
                if (cause instanceof index_js_1.LLMError) {
                    // LLM errors are critical, re-throw them
                    throw cause;
                }
                // Collect planning errors as warnings and continue to next index
                const errorMsg = err instanceof Error ? err.message : String(err);
                const friendlyName = this.getUserFriendlyIndexName(codebaseIndex.artifactId);
                warnings.push(`${friendlyName}: ${errorMsg}`);
                console.warn(`Warning during ${codebaseIndex.artifactId} planning:`, err);
                completedIndexCount += 1;
                progress = completedIndexCount * (1 / indexesToBuild.length);
            }
        }
        // Final update with any collected warnings
        if (warnings.length > 0) {
            yield {
                progress: 1,
                desc: `Indexing completed with ${warnings.length} warning(s)`,
                status: "done",
                warnings: [...warnings],
            };
        }
    }
    // New methods using messenger directly
    updateProgress(update) {
        this.codebaseIndexingState = update;
        if (this.messenger) {
            void this.messenger.request("indexProgress", update);
        }
    }
    async sendIndexingErrorTelemetry(update) {
        console.debug("Indexing failed with error: ", update.desc, update.debugInfo);
    }
    /**
     * We want to prevent sqlite concurrent write errors
     * when there are 2 indexing happening from different windows.
     * We want the other window to wait until the first window's indexing finishes.
     * Incase the first window closes before indexing is finished,
     * we want to unlock the IndexLock by checking the last timestamp.
     */
    async *waitForDBIndex() {
        let foundLock = await refreshIndex_js_1.IndexLock.isLocked();
        while (foundLock?.locked) {
            if ((Date.now() - foundLock.timestamp) / 1000 > 10) {
                console.log(`${foundLock.dirs} is not being indexed... unlocking`);
                await refreshIndex_js_1.IndexLock.unlock();
                break;
            }
            console.log(`indexing ${foundLock.dirs}`);
            yield {
                progress: 0,
                desc: "",
                status: "waiting",
            };
            await new Promise((resolve) => setTimeout(resolve, 1000));
            foundLock = await refreshIndex_js_1.IndexLock.isLocked();
        }
    }
    async wasAnyOneIndexAdded() {
        const indexes = await this.getIndexesToBuild();
        return !indexes.every((index) => this.builtIndexes.some((builtIndex) => builtIndex.artifactId === index.artifactId));
    }
    async refreshCodebaseIndex(paths) {
        if (!this.indexingCancellationController.signal.aborted) {
            this.indexingCancellationController.abort();
        }
        const localController = new AbortController();
        this.indexingCancellationController = localController;
        for await (const update of this.waitForDBIndex()) {
            this.updateProgress(update);
        }
        await refreshIndex_js_1.IndexLock.lock(paths.join(", ")); // acquire the index lock to prevent multiple windows to begin indexing
        const indexLockTimestampUpdateInterval = setInterval(() => void refreshIndex_js_1.IndexLock.updateTimestamp(), 5000);
        try {
            for await (const update of this.refreshDirs(paths, localController.signal)) {
                this.updateProgress(update);
                if (update.status === "failed") {
                    await this.sendIndexingErrorTelemetry(update);
                }
            }
        }
        catch (e) {
            console.log(`Failed refreshing codebase index directories: ${e}`);
            await this.handleIndexingError(e);
        }
        clearInterval(indexLockTimestampUpdateInterval); // interval will also be cleared when window closes before indexing is finished
        await refreshIndex_js_1.IndexLock.unlock();
        // Directly refresh submenu items
        if (this.messenger) {
            this.messenger.send("refreshSubmenuItems", {
                providers: "all",
            });
        }
        if (this.indexingCancellationController === localController) {
            this.indexingCancellationController.abort();
        }
    }
    async refreshCodebaseIndexFiles(files) {
        // Can be cancelled by codebase index but not vice versa
        if (!this.indexingCancellationController.signal.aborted) {
            return;
        }
        const localController = new AbortController();
        this.indexingCancellationController = localController;
        try {
            for await (const update of this.refreshFiles(files)) {
                this.updateProgress(update);
                if (update.status === "failed") {
                    await this.sendIndexingErrorTelemetry(update);
                }
            }
        }
        catch (e) {
            console.log(`Failed refreshing codebase index files: ${e}`);
            await this.handleIndexingError(e);
        }
        // Directly refresh submenu items
        if (this.messenger) {
            this.messenger.send("refreshSubmenuItems", {
                providers: "all",
            });
        }
        if (this.indexingCancellationController === localController) {
            this.indexingCancellationController.abort();
        }
    }
    async handleIndexingError(e) {
        if (e instanceof index_js_1.LLMError && this.messenger) {
            // Need to report this specific error to the IDE for special handling
            void this.messenger.request("reportError", e);
        }
        // broadcast indexing error
        const updateToSend = {
            progress: 0,
            status: "failed",
            desc: e.message,
        };
        this.updateProgress(updateToSend);
        void this.sendIndexingErrorTelemetry(updateToSend);
    }
    get currentIndexingState() {
        return this.codebaseIndexingState;
    }
    hasIndexingContextProvider() {
        return !!this.config.contextProviders?.some(({ description: { dependsOnIndexing } }) => dependsOnIndexing);
    }
    isIndexingConfigSame(config1, config2) {
        return (0, DocsService_js_1.embedModelsAreEqual)(config1?.selectedModelByRole.embed, config2.selectedModelByRole.embed);
    }
    async handleConfigUpdate({ config: newConfig, }) {
        if (newConfig) {
            const ideSettings = await this.ide.getIdeSettings();
            const pauseCodebaseIndexOnStart = ideSettings.pauseCodebaseIndexOnStart;
            if (pauseCodebaseIndexOnStart) {
                this.paused = true;
            }
            const needsReindex = !this.isIndexingConfigSame(this.config, newConfig);
            this.config = newConfig; // IMPORTANT - need to set up top, other methods below use this without passing it in
            // No point in indexing if no codebase context provider
            const hasIndexingProviders = this.hasIndexingContextProvider();
            if (!hasIndexingProviders) {
                return;
            }
            // Skip codebase indexing if not supported
            // No warning message here because would show on ANY config update
            if (!this.config.selectedModelByRole.embed) {
                return;
            }
            if (needsReindex) {
                const dirs = await this.ide.getWorkspaceDirs();
                void this.refreshCodebaseIndex(dirs);
            }
        }
    }
}
exports.CodebaseIndexer = CodebaseIndexer;
//# sourceMappingURL=CodebaseIndexer.js.map