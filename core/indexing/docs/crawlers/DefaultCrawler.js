"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCrawler = void 0;
const node_url_1 = require("node:url");
const headers_1 = require("../../../continueServer/stubs/headers");
const client_1 = require("../../../control-plane/client");
class DefaultCrawler {
    constructor(startUrl, maxRequestsPerCrawl, maxDepth) {
        this.startUrl = startUrl;
        this.maxRequestsPerCrawl = maxRequestsPerCrawl;
        this.maxDepth = maxDepth;
    }
    async crawl() {
        const resp = await fetch(new node_url_1.URL("crawl", client_1.TRIAL_PROXY_URL).toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(await (0, headers_1.getHeaders)()),
            },
            body: JSON.stringify({
                startUrl: this.startUrl.toString(),
                maxDepth: this.maxDepth,
                limit: this.maxRequestsPerCrawl,
            }),
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Failed to crawl site (${resp.status}): ${text}`);
        }
        const json = (await resp.json());
        return json;
    }
}
exports.DefaultCrawler = DefaultCrawler;
//# sourceMappingURL=DefaultCrawler.js.map