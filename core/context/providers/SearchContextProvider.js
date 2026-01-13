"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grepSearch_js_1 = require("../../util/grepSearch.js");
const index_js_1 = require("../index.js");
const DEFAULT_MAX_SEARCH_CONTEXT_RESULTS = 200;
class SearchContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const results = await extras.ide.getSearchResults(query, this.options?.maxResults ?? DEFAULT_MAX_SEARCH_CONTEXT_RESULTS);
        // Note, search context provider will not truncate result chars, but will limit number of results
        const { formatted } = (0, grepSearch_js_1.formatGrepSearchResults)(results);
        return [
            {
                description: "Search results",
                content: `Results of searching codebase for "${query}":\n\n${formatted}`,
                name: "Search results",
            },
        ];
    }
}
SearchContextProvider.description = {
    title: "search",
    displayTitle: "Search",
    description: "Use ripgrep to exact search the workspace",
    type: "query",
    renderInlineAs: "",
};
exports.default = SearchContextProvider;
//# sourceMappingURL=SearchContextProvider.js.map