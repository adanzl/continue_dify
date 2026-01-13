"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWebImpl = void 0;
const WebContextProvider_1 = require("../../context/providers/WebContextProvider");
const parseArgs_1 = require("../parseArgs");
const DEFAULT_WEB_SEARCH_CHAR_LIMIT = 8000;
const searchWebImpl = async (args, extras) => {
    const query = (0, parseArgs_1.getStringArg)(args, "query");
    const webResults = await (0, WebContextProvider_1.fetchSearchResults)(query, 5, extras.fetch);
    // Track truncated results
    const truncatedResults = [];
    // Check and truncate each result
    const processedResults = webResults.map((result, index) => {
        if (result.content.length > DEFAULT_WEB_SEARCH_CHAR_LIMIT) {
            truncatedResults.push(result.name || result.description || `Result #${index + 1}`);
            return {
                ...result,
                content: result.content.substring(0, DEFAULT_WEB_SEARCH_CHAR_LIMIT),
            };
        }
        return result;
    });
    // Add truncation warning if needed
    if (truncatedResults.length > 0) {
        processedResults.push({
            name: "Truncation warning",
            description: "",
            content: `The content from the following search results was truncated because it exceeded the ${DEFAULT_WEB_SEARCH_CHAR_LIMIT} character limit: ${truncatedResults.join(", ")}. For more detailed information, consider refining your search query.`,
        });
    }
    return processedResults;
};
exports.searchWebImpl = searchWebImpl;
//# sourceMappingURL=searchWeb.js.map