"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const DocsService_1 = __importDefault(require("../../indexing/docs/DocsService"));
const utils_1 = require("./utils");
class DocsContextProvider extends __1.BaseContextProvider {
    constructor(options) {
        super(options);
        const docsService = DocsService_1.default.getSingleton();
        docsService?.setGithubToken(this.options?.githubToken);
    }
    async _rerankChunks(chunks, reranker, fullInput, ide) {
        let chunksCopy = [...chunks];
        try {
            const scores = await reranker.rerank(fullInput, chunksCopy);
            if (Array.isArray(scores)) {
                // reranker model has returned a valid array
                chunksCopy.sort((a, b) => scores[chunksCopy.indexOf(b)] - scores[chunksCopy.indexOf(a)]);
            }
            chunksCopy = chunksCopy.splice(0, this.options?.nFinal ?? DocsContextProvider.nFinal);
        }
        catch (e) {
            void ide.showToast("warning", `Failed to rerank retrieval results\n${e}`);
            chunksCopy = chunksCopy.splice(0, this.options?.nFinal ?? DocsContextProvider.nFinal);
        }
        return chunksCopy;
    }
    _sortAlphabetically(submenuItems) {
        // Sort submenu items alphabetically by title
        return submenuItems.sort((a, b) => {
            return a.title.toString().localeCompare(b.title.toString());
        });
    }
    async getContextItems(query, extras) {
        const nRetrieve = this.options?.nRetrieve ?? DocsContextProvider.nRetrieve;
        const useReranking = this.options?.useReranking ?? true;
        // Get docs service
        const docsService = DocsService_1.default.getSingleton();
        if (!docsService) {
            console.error(`${DocsService_1.default.name} has not been initialized`);
            return [];
        }
        await docsService.isInitialized;
        // Get chunks
        let chunks = await docsService.retrieveChunksFromQuery(extras.fullInput, // confusing: fullInput = the query, query = startUrl in this case
        query, nRetrieve);
        if (!chunks?.length) {
            return [];
        }
        // We found chunks, so check if there's a favicon for the docs page
        const favicon = await docsService.getFavicon(query);
        // Rerank if there's a reranker
        if (useReranking && extras.reranker) {
            chunks = await this._rerankChunks(chunks, extras.reranker, extras.fullInput, extras.ide);
        }
        return [
            ...chunks
                .map((chunk) => ({
                icon: favicon,
                name: chunk.filepath.includes("/tree/main") // For display of GitHub files
                    ? chunk.filepath
                        .split("/")
                        .slice(1)
                        .join("/")
                        .split("/tree/main/")
                        .slice(1)
                        .join("/")
                    : chunk.otherMetadata?.title || chunk.filepath,
                description: chunk.filepath,
                content: chunk.content,
                uri: {
                    type: "url",
                    value: chunk.filepath,
                },
            }))
                .reverse(),
            {
                ...utils_1.INSTRUCTIONS_BASE_ITEM,
                content: "Use the above documentation to answer the following question. You should not reference " +
                    "anything outside of what is shown, unless it is a commonly known concept. Reference URLs " +
                    "whenever possible using markdown formatting. If there isn't enough information to answer " +
                    "the question, suggest where the user might look to learn more.",
            },
        ];
    }
    async loadSubmenuItems(args) {
        const { config } = args;
        // This set is used to filter out the docs that is not in docs config but exist in sqlite metadata
        const configDocsSet = new Set(config.docs?.map((doc) => doc.startUrl) || []);
        // Get docs service
        const docsService = DocsService_1.default.getSingleton();
        if (!docsService) {
            console.error(`${DocsService_1.default.name} has not been initialized`);
            return [];
        }
        await docsService.isInitialized;
        // Create an array to hold submenu items
        const submenuItems = [];
        // Get all indexed docs from the database
        const docs = (await docsService.listMetadata()) ?? [];
        for (const { startUrl, title, favicon } of docs) {
            if (configDocsSet.has(startUrl)) {
                submenuItems.push({
                    title,
                    id: startUrl,
                    description: new URL(startUrl).hostname,
                    icon: favicon,
                });
            }
        }
        // Sort alphabetically
        return this._sortAlphabetically(submenuItems);
    }
}
DocsContextProvider.nRetrieve = 30;
DocsContextProvider.nFinal = 15;
DocsContextProvider.description = {
    title: "docs",
    displayTitle: "Docs",
    description: "Type to search docs",
    type: "submenu",
    // Todo: consider a different renderInline so that when multiple docs are referenced in one message,
    // Or the doc has an odd name unrelated to the content
    // The name of the doc itself doesn't skew the embedding results
    renderInlineAs: "",
};
exports.default = DocsContextProvider;
//# sourceMappingURL=DocsContextProvider.js.map