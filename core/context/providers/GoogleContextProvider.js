"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class GoogleContextProvider extends index_js_1.BaseContextProvider {
    constructor(options) {
        super(options);
        this._serperApiKey = options.serperApiKey;
    }
    get deprecationMessage() {
        return "The Google context provider is now deprecated and will be removed in a later version. Please consider using github.com/jae-jae/g-search-mcp instead.";
    }
    async getContextItems(query, extras) {
        const url = "https://google.serper.dev/search";
        const payload = JSON.stringify({ q: query });
        const headers = {
            "X-API-KEY": this._serperApiKey,
            "Content-Type": "application/json",
        };
        const response = await extras.fetch(url, {
            method: "POST",
            headers: headers,
            body: payload,
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Google search results: ${response.statusText}`);
        }
        const results = await response.text();
        try {
            const parsed = JSON.parse(results);
            let content = `Google Search: ${query}\n\n`;
            const answerBox = parsed.answerBox;
            if (answerBox) {
                content += `Answer Box (${answerBox.title}): ${answerBox.answer}\n\n`;
            }
            for (const result of parsed.organic) {
                content += `${result.title}\n${result.link}\n${result.snippet}\n\n`;
            }
            return [
                {
                    content,
                    name: "Google Search",
                    description: "Google Search",
                },
            ];
        }
        catch (e) {
            throw new Error(`Failed to parse Google search results: ${results}`);
        }
    }
}
GoogleContextProvider.description = {
    title: "google",
    displayTitle: "Google",
    description: "Attach the results of a Google search",
    type: "query",
};
exports.default = GoogleContextProvider;
//# sourceMappingURL=GoogleContextProvider.js.map