"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSearchResults = void 0;
const __1 = require("..");
const headers_1 = require("../../continueServer/stubs/headers");
const client_1 = require("../../control-plane/client");
const fetchSearchResults = async (query, n, fetchFn) => {
    const resp = await fetchFn(WebContextProvider.ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await (0, headers_1.getHeaders)()),
        },
        body: JSON.stringify({
            query,
            n,
        }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to fetch web context: ${text}`);
    }
    return await resp.json();
};
exports.fetchSearchResults = fetchSearchResults;
class WebContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        return await (0, exports.fetchSearchResults)(extras.fullInput, this.options.n ?? WebContextProvider.DEFAULT_N, extras.fetch);
    }
}
WebContextProvider.ENDPOINT = new URL("web", client_1.TRIAL_PROXY_URL);
WebContextProvider.DEFAULT_N = 6;
WebContextProvider.description = {
    title: "web",
    displayTitle: "Web",
    description: "Search the web",
    type: "normal",
    renderInlineAs: "",
};
exports.default = WebContextProvider;
//# sourceMappingURL=WebContextProvider.js.map