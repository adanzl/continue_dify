"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codebaseToolImpl = void 0;
const retrieval_1 = require("../../context/retrieval/retrieval");
const parseArgs_1 = require("../parseArgs");
const codebaseToolImpl = async (args, extras) => {
    const query = (0, parseArgs_1.getStringArg)(args, "query");
    try {
        const contextExtras = {
            config: extras.config,
            fullInput: query,
            embeddingsProvider: extras.config.selectedModelByRole.embed,
            reranker: extras.config.selectedModelByRole.rerank,
            llm: extras.llm,
            ide: extras.ide,
            selectedCode: [],
            fetch: extras.fetch,
            isInAgentMode: true, // always true in tool call
        };
        // Use the existing retrieval function to get context items
        const results = await (0, retrieval_1.retrieveContextItemsFromEmbeddings)(contextExtras, undefined, undefined);
        // If no results found, return helpful message
        if (results.length === 0) {
            return [
                {
                    name: "No Results",
                    description: "Codebase search",
                    content: `No relevant code found for query: "${query}". This could mean:
- The codebase hasn't been indexed yet
- No code matches the search criteria
- Embeddings provider is not configured

Try re-indexing the codebase or using a more specific query.`,
                },
            ];
        }
        return results;
    }
    catch (error) {
        return [
            {
                name: "Error",
                description: "Codebase search error",
                content: `Failed to search codebase: ${error instanceof Error ? error.message : String(error)}`,
            },
        ];
    }
};
exports.codebaseToolImpl = codebaseToolImpl;
//# sourceMappingURL=codebaseTool.js.map