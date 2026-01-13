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
exports.embedModelsAreEqual = embedModelsAreEqual;
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
const util_1 = require("../../config/util");
const DocsContextProvider_1 = __importDefault(require("../../context/providers/DocsContextProvider"));
const TransformersJsEmbeddingsProvider_1 = __importDefault(require("../../llm/llms/TransformersJsEmbeddingsProvider"));
const fetchFavicon_1 = require("../../util/fetchFavicon");
const GlobalContext_1 = require("../../util/GlobalContext");
const paths_1 = require("../../util/paths");
const posthog_1 = require("../../util/posthog");
const article_1 = require("./article");
const DocsCrawler_1 = __importDefault(require("./crawlers/DocsCrawler"));
const migrations_1 = require("./migrations");
const llm_1 = require("../../llm");
const markFailedInGlobalContext = (siteIndexingConfig) => {
    const globalContext = new GlobalContext_1.GlobalContext();
    const failedDocs = globalContext.get("failedDocs") ?? [];
    const newFailedDocs = failedDocs.filter((d) => !docConfigsAreEqual(siteIndexingConfig, d));
    newFailedDocs.push(siteIndexingConfig);
    globalContext.update("failedDocs", newFailedDocs);
};
const removeFromFailedGlobalContext = (siteIndexingConfig) => {
    const globalContext = new GlobalContext_1.GlobalContext();
    const failedDocs = globalContext.get("failedDocs") ?? [];
    const newFailedDocs = failedDocs.filter((d) => !docConfigsAreEqual(siteIndexingConfig, d));
    globalContext.update("failedDocs", newFailedDocs);
};
const hasIndexingFailed = (siteIndexingConfig) => {
    const globalContext = new GlobalContext_1.GlobalContext();
    const failedDocs = globalContext.get("failedDocs") ?? [];
    return failedDocs.find((d) => docConfigsAreEqual(siteIndexingConfig, d));
};
function embedModelsAreEqual(llm1, llm2) {
    return (llm1?.underlyingProviderName === llm2?.underlyingProviderName &&
        llm1?.title === llm2?.title &&
        llm1?.maxEmbeddingChunkSize === llm2?.maxEmbeddingChunkSize);
}
const docConfigsAreEqual = (siteConfig1, siteConfig2) => {
    return (siteConfig1.faviconUrl === siteConfig2.faviconUrl &&
        siteConfig1.title === siteConfig2.title &&
        docConfigsAreEqualExceptTitleAndFavicon(siteConfig1, siteConfig2));
};
const docConfigsAreEqualExceptTitleAndFavicon = (siteConfig1, siteConfig2) => {
    return (siteConfig1.startUrl === siteConfig2.startUrl &&
        siteConfig1.maxDepth === siteConfig2.maxDepth &&
        siteConfig1.useLocalCrawling === siteConfig2.useLocalCrawling);
};
const siteIndexingConfigsAreEqual = (siteConfig1, siteConfig2, contConfig1, contConfig2) => {
    return (docConfigsAreEqual(siteConfig1, siteConfig2) &&
        embedModelsAreEqual(contConfig1?.selectedModelByRole.embed, contConfig2.selectedModelByRole.embed));
};
const siteIndexingConfigsAreEqualExceptTitleAndFavicon = (siteConfig1, siteConfig2, contConfig1, contConfig2) => {
    return (docConfigsAreEqualExceptTitleAndFavicon(siteConfig1, siteConfig2) &&
        embedModelsAreEqual(contConfig1?.selectedModelByRole.embed, contConfig2.selectedModelByRole.embed));
};
/*
  General process:
  - On config update:
    - Reindex ALL docs if embeddings provider has changed
    - Otherwise, reindex docs with CHANGED URL/DEPTH
    - And update docs with CHANGED TITLE/FAVICON
  - Also, messages to core can trigger:
    - delete
    - reindex all
    - add/index one
*/
class DocsService {
    constructor(configHandler, ide, messenger) {
        this.ide = ide;
        this.messenger = messenger;
        this.isSyncing = false;
        this.docsIndexingQueue = new Set();
        this.lanceTableNamesSet = new Set();
        this.statuses = new Map();
        this.ideInfoPromise = this.ide.getIdeInfo();
        this.isInitialized = this.init(configHandler);
    }
    setGithubToken(token) {
        this.githubToken = token;
    }
    async initLanceDb() {
        if (!(0, util_1.isSupportedLanceDbCpuTargetForLinux)()) {
            return null;
        }
        try {
            if (!DocsService.lance) {
                DocsService.lance = await Promise.resolve().then(() => __importStar(require("vectordb")));
            }
            return DocsService.lance;
        }
        catch (err) {
            console.error("Failed to load LanceDB:", err);
            return null;
        }
    }
    static createSingleton(configHandler, ide, messenger) {
        const docsService = new DocsService(configHandler, ide, messenger);
        DocsService.instance = docsService;
        return docsService;
    }
    static getSingleton() {
        return DocsService.instance;
    }
    // Initialization - load config and attach config listener
    async init(configHandler) {
        const result = await configHandler.loadConfig();
        await this.handleConfigUpdate(result);
        configHandler.onConfigUpdate(this.handleConfigUpdate.bind(this));
    }
    handleStatusUpdate(update) {
        this.statuses.set(update.id, update);
        this.messenger?.send("indexing/statusUpdate", update);
    }
    // A way for gui to retrieve initial statuses
    async initStatuses() {
        if (!this.config?.docs) {
            return;
        }
        const metadata = await this.listMetadata();
        this.config.docs?.forEach((doc) => {
            if (!doc.startUrl) {
                console.error("Invalid config docs entry, no start url", doc.title);
                return;
            }
            const currentStatus = this.statuses.get(doc.startUrl);
            if (currentStatus) {
                this.handleStatusUpdate(currentStatus);
                return;
            }
            const sharedStatus = {
                type: "docs",
                id: doc.startUrl,
                isReindexing: false,
                title: doc.title,
                debugInfo: `max depth: ${doc.maxDepth ?? "unlimited"}`,
                icon: doc.faviconUrl,
                url: doc.startUrl,
            };
            if (this.config.selectedModelByRole.embed) {
                sharedStatus.embeddingsProviderId =
                    this.config.selectedModelByRole.embed.embeddingId;
            }
            const indexedStatus = metadata.find((meta) => meta.startUrl === doc.startUrl)
                ? {
                    ...sharedStatus,
                    progress: 0,
                    description: "Pending",
                    status: "pending",
                }
                : {
                    ...sharedStatus,
                    progress: 1,
                    description: "Complete",
                    status: "complete",
                };
            this.handleStatusUpdate(indexedStatus);
        });
    }
    abort(startUrl) {
        if (this.docsIndexingQueue.has(startUrl)) {
            const status = this.statuses.get(startUrl);
            if (status) {
                this.handleStatusUpdate({
                    ...status,
                    status: "aborted",
                    progress: 0,
                    description: "Canceled",
                });
            }
            this.docsIndexingQueue.delete(startUrl);
        }
    }
    // Used to check periodically during indexing if should cancel indexing
    shouldCancel(startUrl, startedWithEmbedder) {
        // Check if aborted
        const isAborted = this.statuses.get(startUrl)?.status === "aborted";
        if (isAborted) {
            return true;
        }
        // Handle embeddings provider change mid-indexing
        if (this.config.selectedModelByRole.embed?.embeddingId !== startedWithEmbedder) {
            this.abort(startUrl);
            return true;
        }
        return false;
    }
    // Determine if transformers.js embeddings are supported in this environment
    async canUseTransformersEmbeddings() {
        const ideInfo = await this.ideInfoPromise;
        if (ideInfo.ideType === "jetbrains") {
            return false;
        }
        return true;
    }
    // Get the appropriate embeddings provider
    async getEmbeddingsProvider() {
        // First check if there's a config selected embeddings provider
        if (this.config.selectedModelByRole.embed) {
            return {
                provider: this.config.selectedModelByRole.embed,
            };
        }
        // Fall back to transformers if supported
        const canUseTransformers = await this.canUseTransformersEmbeddings();
        if (canUseTransformers) {
            return {
                provider: DocsService.defaultEmbeddingsProvider,
            };
        }
        // No provider available
        return {
            provider: undefined,
        };
    }
    async handleConfigUpdate({ config: newConfig, }) {
        if (newConfig) {
            const oldConfig = this.config;
            this.config = newConfig; // IMPORTANT - need to set up top, other methods below use this without passing it in
            // No point in indexing if no docs context provider
            const hasDocsContextProvider = this.hasDocsContextProvider();
            if (!hasDocsContextProvider) {
                return;
            }
            // Skip docs indexing if not supported
            // No warning message here because would show on ANY config update
            if (!this.config.selectedModelByRole.embed) {
                return;
            }
            await this.syncDocs(oldConfig, newConfig, false);
        }
    }
    async syncDocsWithPrompt(reIndex = false) {
        await this.syncDocs(undefined, this.config, reIndex);
        void this.ide.showToast("info", "Docs indexing completed");
    }
    // Returns true if startUrl has been indexed with current embeddingsProvider
    async hasMetadata(startUrl) {
        if (!this.config.selectedModelByRole.embed) {
            return false;
        }
        const db = await this.getOrCreateSqliteDb();
        const title = await db.get(`SELECT title FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`, startUrl, this.config.selectedModelByRole.embed.embeddingId);
        return !!title;
    }
    async listMetadata() {
        const embeddingsProvider = this.config.selectedModelByRole.embed;
        if (!embeddingsProvider) {
            return [];
        }
        const db = await this.getOrCreateSqliteDb();
        const docs = await db.all(`SELECT title, startUrl, favicon FROM ${DocsService.sqlitebTableName}
      WHERE embeddingsProviderId = ?`, embeddingsProvider.embeddingId);
        return docs;
    }
    async reindexDoc(startUrl) {
        const docConfig = this.config.docs?.find((doc) => doc.startUrl === startUrl);
        if (docConfig) {
            await this.indexAndAdd(docConfig, true);
        }
    }
    // eslint-disable-next-line max-statements
    async indexAndAdd(siteIndexingConfig, forceReindex = false) {
        const { startUrl, useLocalCrawling, maxDepth, faviconUrl } = siteIndexingConfig;
        // First, if indexing is already in process, don't attempt
        // This queue is necessary because indexAndAdd is invoked circularly by config edits
        // TODO shouldn't really be a gap between adding and checking in queue but probably fine
        if (this.docsIndexingQueue.has(startUrl)) {
            return;
        }
        const { provider } = await this.getEmbeddingsProvider();
        if (!provider) {
            console.warn("@docs indexAndAdd: no embeddings provider found");
            return;
        }
        const startedWithEmbedder = provider.embeddingId;
        // Check if doc has been successfully indexed with the given embedder
        const indexExists = await this.hasMetadata(startUrl);
        // Build status update - most of it is fixed values
        const fixedStatus = {
            type: "docs",
            id: siteIndexingConfig.startUrl,
            embeddingsProviderId: provider.embeddingId,
            isReindexing: forceReindex && indexExists,
            title: siteIndexingConfig.title,
            debugInfo: `max depth: ${siteIndexingConfig.maxDepth ?? "unlimited"}`,
            icon: siteIndexingConfig.faviconUrl,
            url: siteIndexingConfig.startUrl,
        };
        // If not force-reindexing and has failed with same config, don't reattempt
        if (!forceReindex) {
            if (hasIndexingFailed(siteIndexingConfig)) {
                console.log(`Not reattempting to index ${siteIndexingConfig.startUrl}, has already failed with same config`);
                this.handleStatusUpdate({
                    ...fixedStatus,
                    description: "Failed",
                    status: "failed",
                    progress: 1,
                });
                return;
            }
        }
        if (indexExists && !forceReindex) {
            this.handleStatusUpdate({
                ...fixedStatus,
                progress: 1,
                description: "Complete",
                status: "complete",
                debugInfo: "Already indexed",
            });
            return;
        }
        // Do a test run on the embedder
        // This particular failure will not mark as a failed config in global context
        // Since SiteIndexingConfig is likely to be valid
        try {
            await provider.embed(["continue-test-run"]);
        }
        catch (e) {
            if (e instanceof llm_1.LLMError) {
                // Report the error to the IDE
                await this.messenger?.request("reportError", e);
            }
            this.handleStatusUpdate({
                ...fixedStatus,
                description: `Failed to test embeddings connection. ${e}`,
                status: "failed",
                progress: 1,
            });
            console.error("Failed to test embeddings connection", e);
            return;
        }
        try {
            this.docsIndexingQueue.add(startUrl);
            // Clear current indexes if reIndexing
            if (indexExists && forceReindex) {
                await this.deleteIndexes(startUrl);
            }
            this.addToConfig(siteIndexingConfig);
            this.handleStatusUpdate({
                ...fixedStatus,
                status: "indexing",
                description: "Finding subpages",
                progress: 0,
            });
            // Crawl pages to get page data
            const pages = [];
            let processedPages = 0;
            let estimatedProgress = 0;
            let done = false;
            let usedCrawler = undefined;
            const docsCrawler = new DocsCrawler_1.default(this.ide, this.config, maxDepth, undefined, useLocalCrawling, this.githubToken);
            const crawlerGen = docsCrawler.crawl(new URL(startUrl));
            while (!done) {
                const result = await crawlerGen.next();
                if (result.done) {
                    done = true;
                    usedCrawler = result.value;
                }
                else {
                    const page = result.value;
                    estimatedProgress += 1 / 2 ** (processedPages + 1);
                    // NOTE - during "indexing" phase, check if aborted before each status update
                    if (this.shouldCancel(startUrl, startedWithEmbedder)) {
                        return;
                    }
                    this.handleStatusUpdate({
                        ...fixedStatus,
                        description: `Finding subpages (${page.path})`,
                        status: "indexing",
                        progress: 0.15 * estimatedProgress +
                            Math.min(0.35, (0.35 * processedPages) / 500),
                        // For the first 50%, 15% is sum of series 1/(2^n) and the other 35% is based on number of files/ 500 max
                    });
                    pages.push(page);
                    processedPages++;
                    // Locks down GUI if no sleeping
                    // Wait proportional to how many docs are indexing
                    const toWait = 100 * this.docsIndexingQueue.size + 50;
                    await new Promise((resolve) => setTimeout(resolve, toWait));
                }
            }
            void posthog_1.Telemetry.capture("docs_pages_crawled", {
                count: processedPages,
            });
            // Chunk pages based on which crawler was used
            const articles = [];
            const chunks = [];
            const articleChunker = usedCrawler === "github"
                ? article_1.markdownPageToArticleWithChunks
                : article_1.htmlPageToArticleWithChunks;
            for (const page of pages) {
                const articleWithChunks = await articleChunker(page, provider.maxEmbeddingChunkSize);
                if (articleWithChunks) {
                    articles.push(articleWithChunks);
                }
                const toWait = 20 * this.docsIndexingQueue.size + 10;
                await new Promise((resolve) => setTimeout(resolve, toWait));
            }
            // const chunks: Chunk[] = [];
            const embeddings = [];
            // Create embeddings of retrieved articles
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                if (this.shouldCancel(startUrl, startedWithEmbedder)) {
                    return;
                }
                this.handleStatusUpdate({
                    ...fixedStatus,
                    status: "indexing",
                    description: `Creating Embeddings: ${article.article.subpath}`,
                    progress: 0.5 + 0.3 * (i / articles.length), // 50% -> 80%
                });
                try {
                    const subpathEmbeddings = article.chunks.length > 0
                        ? await provider.embed(article.chunks.map((c) => c.content))
                        : [];
                    chunks.push(...article.chunks);
                    embeddings.push(...subpathEmbeddings);
                    const toWait = 100 * this.docsIndexingQueue.size + 50;
                    await new Promise((resolve) => setTimeout(resolve, toWait));
                }
                catch (e) {
                    console.warn("Error embedding article chunks: ", e);
                }
            }
            if (embeddings.length === 0) {
                console.error(`No embeddings were created for site: ${startUrl}\n Num chunks: ${chunks.length}`);
                if (this.shouldCancel(startUrl, startedWithEmbedder)) {
                    return;
                }
                this.handleStatusUpdate({
                    ...fixedStatus,
                    description: `No embeddings were created for site: ${startUrl}`,
                    status: "failed",
                    progress: 1,
                });
                // void this.ide.showToast("info", `Failed to index ${startUrl}`);
                markFailedInGlobalContext(siteIndexingConfig);
                return;
            }
            // Add docs to databases
            console.log(`Adding ${embeddings.length} embeddings to db`);
            if (this.shouldCancel(startUrl, startedWithEmbedder)) {
                return;
            }
            this.handleStatusUpdate({
                ...fixedStatus,
                description: "Deleting old embeddings from the db",
                status: "indexing",
                progress: 0.8,
            });
            // Delete indexed docs if re-indexing
            if (forceReindex && indexExists) {
                console.log("Deleting old embeddings");
                await this.deleteIndexes(startUrl);
            }
            const favicon = faviconUrl ||
                (await (0, fetchFavicon_1.fetchFavicon)(new URL(siteIndexingConfig.startUrl)));
            if (this.shouldCancel(startUrl, startedWithEmbedder)) {
                return;
            }
            this.handleStatusUpdate({
                ...fixedStatus,
                description: `Adding ${embeddings.length} embeddings to db`,
                status: "indexing",
                progress: 0.85,
            });
            await this.add({
                siteIndexingConfig,
                chunks,
                embeddings,
                favicon,
            });
            this.handleStatusUpdate({
                ...fixedStatus,
                description: "Complete",
                status: "complete",
                progress: 1,
            });
            // Only show notificaitons if the user manually re-indexed, otherwise
            // they are too noisy, especially when switching embeddings providers
            // and we automatically re-index all docs
            if (forceReindex) {
                void this.ide.showToast("info", `Successfully indexed ${startUrl}`);
            }
            removeFromFailedGlobalContext(siteIndexingConfig);
        }
        catch (e) {
            console.error(`Error indexing docs at: ${siteIndexingConfig.startUrl}`, e);
            let description = `Error indexing docs at: ${siteIndexingConfig.startUrl}`;
            if (e instanceof Error) {
                if (e.message.includes("github.com") &&
                    e.message.includes("rate limit")) {
                    description = "Github rate limit exceeded"; // This text is used verbatim elsewhere
                }
            }
            this.handleStatusUpdate({
                ...fixedStatus,
                description,
                status: "failed",
                progress: 1,
            });
            markFailedInGlobalContext(siteIndexingConfig);
        }
        finally {
            this.docsIndexingQueue.delete(startUrl);
        }
    }
    // Retrieve docs embeds based on user input
    async retrieveChunksFromQuery(query, startUrl, nRetrieve) {
        const { provider } = await this.getEmbeddingsProvider();
        if (!provider) {
            void this.ide.showToast("error", "Set up an embeddings model to use the @docs context provider. See: " +
                "https://docs.continue.dev/customize/model-roles/embeddings");
            return [];
        }
        // Try to get embeddings for the query
        const [vector] = await provider.embed([query]);
        // Retrieve chunks using the query vector
        return await this.retrieveChunks(startUrl, vector, nRetrieve);
    }
    lanceDBRowToChunk(row) {
        return {
            digest: row.path,
            filepath: row.path,
            startLine: row.startline,
            endLine: row.endline,
            index: 0,
            content: row.content,
            otherMetadata: {
                title: row.title,
            },
        };
    }
    async getDetails(startUrl) {
        const db = await this.getOrCreateSqliteDb();
        try {
            const { provider } = await this.getEmbeddingsProvider();
            if (!provider) {
                throw new Error("No embeddings model set");
            }
            const result = await db.get(`SELECT startUrl, title, favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`, startUrl, provider.embeddingId);
            if (!result) {
                throw new Error(`${startUrl} not found in sqlite`);
            }
            const siteIndexingConfig = {
                startUrl,
                faviconUrl: result.favicon,
                title: result.title,
            };
            const table = await this.getOrCreateLanceTable({
                initializationVector: [],
                startUrl,
            });
            const rows = (await table
                .filter(`starturl = '${startUrl}'`)
                .limit(1000)
                .execute());
            return {
                startUrl,
                config: siteIndexingConfig,
                indexingStatus: this.statuses.get(startUrl),
                chunks: rows.map(this.lanceDBRowToChunk),
            };
        }
        catch (e) {
            console.warn("Error getting details", e);
            throw e;
        }
    }
    // This function attempts to retrieve chunks by vector similarity
    async retrieveChunks(startUrl, vector, nRetrieve, isRetry = false) {
        // Get the appropriate embeddings provider
        const { provider } = await this.getEmbeddingsProvider();
        if (!provider) {
            return [];
        }
        // Lance doesn't have an embeddingsprovider column, instead it includes it in the table name
        const table = await this.getOrCreateLanceTable({
            initializationVector: vector,
            startUrl,
        });
        let docs = [];
        try {
            docs = await table
                .search(vector)
                .limit(nRetrieve)
                .where(`starturl = '${startUrl}'`)
                .execute();
        }
        catch (e) {
            console.warn("Error retrieving chunks from LanceDB", e);
        }
        return docs.map(this.lanceDBRowToChunk);
    }
    async getIndexedPages(startUrl) {
        try {
            const table = await this.getOrCreateLanceTable({
                initializationVector: [],
                startUrl,
            });
            const rows = (await table
                .filter(`starturl = '${startUrl}'`)
                .select(["path"]) // Only select path to minimize data transfer
                .limit(99999999) // Default is 10, we want to show all
                .execute());
            // Get unique paths (pages)
            return new Set(rows.map((row) => row.path));
        }
        catch (e) {
            console.warn(`Error getting page list for ${startUrl}:`, e);
            return new Set();
        }
    }
    // SQLITE DB
    async getOrCreateSqliteDb() {
        if (!this.sqliteDb) {
            const db = await (0, sqlite_1.open)({
                filename: (0, paths_1.getDocsSqlitePath)(),
                driver: sqlite3_1.default.Database,
            });
            await db.exec("PRAGMA busy_timeout = 3000;");
            // First create the table if it doesn't exist
            await db.exec(`CREATE TABLE IF NOT EXISTS ${DocsService.sqlitebTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title STRING NOT NULL,
            startUrl STRING NOT NULL,
            favicon STRING,
            embeddingsProviderId STRING
        )`);
            await (0, migrations_1.runSqliteMigrations)(db);
            this.sqliteDb = db;
        }
        return this.sqliteDb;
    }
    async getFavicon(startUrl) {
        if (!this.config.selectedModelByRole.embed) {
            console.warn("Attempting to get favicon without embeddings provider specified");
            return;
        }
        const db = await this.getOrCreateSqliteDb();
        const result = await db.get(`SELECT favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`, startUrl, this.config.selectedModelByRole.embed.embeddingId);
        if (!result) {
            return;
        }
        return result.favicon;
    }
    /**
     * Sync with no embeddings provider change
     */
    async syncDocs(oldConfig, newConfig, forceReindex) {
        try {
            this.isSyncing = true;
            // Otherwise sync the index based on config changes
            const oldConfigDocs = oldConfig?.docs || [];
            const newConfigDocs = newConfig.docs || [];
            // NOTE since listMetadata filters by embeddings provider id embedding model changes are accounted for here
            const currentlyIndexedDocs = await this.listMetadata();
            const currentStartUrls = currentlyIndexedDocs.map((doc) => doc.startUrl);
            // Anything found in old config, new config, AND sqlite that doesn't match should be reindexed
            // Anything found in new config that isn't in sqlite should be added/indexed
            const addedDocs = [];
            const changedDocs = [];
            for (const doc of newConfigDocs) {
                const currentIndexedDoc = currentStartUrls.includes(doc.startUrl);
                if (currentIndexedDoc) {
                    const oldConfigDoc = oldConfigDocs.find((d) => d.startUrl === doc.startUrl);
                    // TODO: Changes to the docs config made while Continue isn't running won't be caught
                    if (oldConfigDoc &&
                        !siteIndexingConfigsAreEqual(oldConfigDoc, doc, oldConfig, newConfig)) {
                        // When only the title or faviconUrl changed, Update the sqlite metadate instead of reindexing
                        if (siteIndexingConfigsAreEqualExceptTitleAndFavicon(oldConfigDoc, doc, oldConfig, newConfig)) {
                            await this.updateMetadataInSqlite(doc);
                        }
                        else {
                            changedDocs.push(doc);
                        }
                    }
                    else {
                        if (forceReindex) {
                            changedDocs.push(doc);
                        }
                        else {
                            // This is a temperary fix to catch the changes to the docs config that were made when Continue isn't running
                            // We only update title and faviconUrl here
                            await this.updateMetadataInSqlite(doc);
                            // if get's here, not changed, no update needed, mark as complete
                            this.handleStatusUpdate({
                                type: "docs",
                                id: doc.startUrl,
                                embeddingsProviderId: this.config.selectedModelByRole.embed?.embeddingId,
                                isReindexing: false,
                                title: doc.title,
                                debugInfo: "Config sync: not changed",
                                icon: doc.faviconUrl,
                                url: doc.startUrl,
                                progress: 1,
                                description: "Complete",
                                status: "complete",
                            });
                        }
                    }
                }
                else {
                    addedDocs.push(doc);
                    void posthog_1.Telemetry.capture("add_docs_config", { url: doc.startUrl });
                }
            }
            await Promise.allSettled([
                ...changedDocs.map((doc) => this.indexAndAdd(doc, true)),
                ...addedDocs.map((doc) => this.indexAndAdd(doc)),
            ]);
        }
        catch (e) {
            console.error("Error syncing docs index on config update", e);
        }
        finally {
            this.isSyncing = false;
            // Refresh the submenu items for docs
            this.messenger?.send("refreshSubmenuItems", {
                providers: ["docs"],
            });
        }
    }
    hasDocsContextProvider() {
        return !!this.config.contextProviders?.some((provider) => provider.description.title === DocsContextProvider_1.default.description.title);
    }
    // Lance DB Initialization
    async createLanceDocsTable(connection, initializationVector, tableName) {
        const mockRowTitle = "mockRowTitle";
        const mockRow = [
            {
                title: mockRowTitle,
                vector: initializationVector,
                starturl: "",
                content: "",
                path: "",
                startline: 0,
                endline: 0,
            },
        ];
        const table = await connection.createTable(tableName, mockRow);
        await (0, migrations_1.runLanceMigrations)(table);
        await table.delete(`title = '${mockRowTitle}'`);
    }
    /**
     * From Lance: Table names can only contain alphanumeric characters,
     * underscores, hyphens, and periods
     */
    sanitizeLanceTableName(name) {
        return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    }
    async getLanceTableName(embeddingsProvider) {
        const tableName = this.sanitizeLanceTableName(`${DocsService.lanceTableName}${embeddingsProvider.embeddingId}`);
        return tableName;
    }
    async getOrCreateLanceTable({ initializationVector, startUrl, }) {
        const lance = await this.initLanceDb();
        if (!lance) {
            throw new Error("LanceDB not available on this platform");
        }
        const conn = await lance.connect((0, paths_1.getLanceDbPath)());
        const tableNames = await conn.tableNames();
        const { provider } = await this.getEmbeddingsProvider();
        if (!provider) {
            throw new Error("Could not retrieve @docs Lance Table: no embeddings provider specified");
        }
        const tableNameFromEmbeddingsProvider = await this.getLanceTableName(provider);
        if (!tableNames.includes(tableNameFromEmbeddingsProvider)) {
            if (initializationVector) {
                await this.createLanceDocsTable(conn, initializationVector, tableNameFromEmbeddingsProvider);
            }
            else {
                console.trace("No existing Lance DB docs table was found and no initialization " +
                    "vector was passed to create one");
            }
        }
        const table = await conn.openTable(tableNameFromEmbeddingsProvider);
        this.lanceTableNamesSet.add(tableNameFromEmbeddingsProvider);
        return table;
    }
    // Methods for adding individual docs
    async addToLance({ chunks, siteIndexingConfig, embeddings, }) {
        const sampleVector = embeddings[0];
        const { startUrl } = siteIndexingConfig;
        const table = await this.getOrCreateLanceTable({
            startUrl,
            initializationVector: sampleVector,
        });
        const rows = chunks.map((chunk, i) => ({
            vector: embeddings[i],
            starturl: startUrl,
            title: chunk.otherMetadata?.title || siteIndexingConfig.title,
            content: chunk.content,
            path: chunk.filepath,
            startline: chunk.startLine,
            endline: chunk.endLine,
        }));
        await table.add(rows);
    }
    async addMetadataToSqlite({ siteIndexingConfig: { title, startUrl }, favicon, }) {
        if (!this.config.selectedModelByRole.embed) {
            console.warn(`Attempting to add metadata for ${startUrl} without embeddings provider specified`);
            return;
        }
        const db = await this.getOrCreateSqliteDb();
        await db.run(`INSERT INTO ${DocsService.sqlitebTableName} (title, startUrl, favicon, embeddingsProviderId) VALUES (?, ?, ?, ?)`, title, startUrl, favicon, this.config.selectedModelByRole.embed.embeddingId);
    }
    async updateMetadataInSqlite(siteIndexingConfig) {
        const { startUrl, title, faviconUrl } = siteIndexingConfig;
        const favicon = faviconUrl || (await (0, fetchFavicon_1.fetchFavicon)(new URL(startUrl)));
        if (!this.config.selectedModelByRole.embed) {
            console.warn(`Attempting to add metadata for ${startUrl} without embeddings provider specified`);
            return;
        }
        const db = await this.getOrCreateSqliteDb();
        await db.run(`UPDATE ${DocsService.sqlitebTableName} SET title = ?, favicon = ? WHERE startUrl = ? AND embeddingsProviderId = ?`, title, favicon, startUrl, this.config.selectedModelByRole.embed.embeddingId);
    }
    addToConfig(siteIndexingConfig) {
        // Handles the case where a user has manually added the doc to config.json
        // so it already exists in the file
        const doesEquivalentDocExist = this.config.docs?.some((doc) => docConfigsAreEqual(doc, siteIndexingConfig));
        if (!doesEquivalentDocExist) {
            (0, paths_1.editConfigFile)((config) => ({
                ...config,
                docs: [
                    ...(config.docs?.filter((doc) => doc.startUrl !== siteIndexingConfig.startUrl) ?? []),
                    siteIndexingConfig,
                ],
            }), (config) => ({
                ...config,
                docs: [
                    ...(config.docs?.filter((doc) => doc.startUrl !== siteIndexingConfig.startUrl) ?? []),
                    {
                        name: siteIndexingConfig.title,
                        faviconUrl: siteIndexingConfig.faviconUrl,
                        startUrl: siteIndexingConfig.startUrl,
                    },
                ],
            }));
        }
    }
    async add(params) {
        await this.addToLance(params);
        await this.addMetadataToSqlite(params);
    }
    // Delete methods
    async deleteEmbeddingsFromLance(startUrl) {
        const lance = await this.initLanceDb();
        if (!lance) {
            return;
        }
        for (const tableName of this.lanceTableNamesSet) {
            const conn = await lance.connect((0, paths_1.getLanceDbPath)());
            const table = await conn.openTable(tableName);
            await table.delete(`starturl = '${startUrl}'`);
        }
    }
    async deleteMetadataFromSqlite(startUrl) {
        if (!this.config.selectedModelByRole.embed) {
            console.warn(`Attempting to delete metadata for ${startUrl} without embeddings provider specified`);
            return;
        }
        const db = await this.getOrCreateSqliteDb();
        await db.run(`DELETE FROM ${DocsService.sqlitebTableName} WHERE startUrl = ? AND embeddingsProviderId = ?`, startUrl, this.config.selectedModelByRole.embed.embeddingId);
    }
    deleteFromConfig(startUrl) {
        const doesDocExist = this.config.docs?.some((doc) => doc.startUrl === startUrl);
        if (doesDocExist) {
            (0, paths_1.editConfigFile)((config) => ({
                ...config,
                docs: config.docs?.filter((doc) => doc.startUrl !== startUrl) || [],
            }), (config) => ({
                ...config,
                docs: config.docs?.filter((doc) => "startUrl" in doc && doc.startUrl !== startUrl) || [],
            }));
        }
    }
    async deleteIndexes(startUrl) {
        await this.deleteEmbeddingsFromLance(startUrl);
        await this.deleteMetadataFromSqlite(startUrl);
    }
    async delete(startUrl) {
        this.docsIndexingQueue.delete(startUrl);
        this.abort(startUrl);
        await this.deleteIndexes(startUrl);
        this.deleteFromConfig(startUrl);
        this.messenger?.send("refreshSubmenuItems", {
            providers: ["docs"],
        });
        this.statuses.delete(startUrl);
    }
}
DocsService.lance = null;
DocsService.lanceTableName = "docs";
DocsService.sqlitebTableName = "docs";
DocsService.defaultEmbeddingsProvider = new TransformersJsEmbeddingsProvider_1.default();
exports.default = DocsService;
//# sourceMappingURL=DocsService.js.map