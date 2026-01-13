"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUrlContentImpl = void 0;
const URLContextProvider_1 = require("../../context/providers/URLContextProvider");
const parseArgs_1 = require("../parseArgs");
const DEFAULT_FETCH_URL_CHAR_LIMIT = 20000;
const fetchUrlContentImpl = async (args, extras) => {
    const url = (0, parseArgs_1.getStringArg)(args, "url");
    const contextItems = await (0, URLContextProvider_1.getUrlContextItems)(url, extras.fetch);
    // Track truncated content
    const truncatedUrls = [];
    // Check and truncate each context item
    const processedItems = contextItems.map((item) => {
        if (item.content.length > DEFAULT_FETCH_URL_CHAR_LIMIT) {
            truncatedUrls.push(url);
            return {
                ...item,
                content: item.content.substring(0, DEFAULT_FETCH_URL_CHAR_LIMIT),
            };
        }
        return item;
    });
    // Add truncation warning if needed
    if (truncatedUrls.length > 0) {
        processedItems.push({
            name: "Truncation warning",
            description: "",
            content: `The content from ${truncatedUrls.join(", ")} was truncated because it exceeded the ${DEFAULT_FETCH_URL_CHAR_LIMIT} character limit. If you need more content, consider fetching specific sections or using a more targeted approach.`,
        });
    }
    return processedItems;
};
exports.fetchUrlContentImpl = fetchUrlContentImpl;
//# sourceMappingURL=fetchUrlContent.js.map