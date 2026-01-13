"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUrlContextItems = getUrlContextItems;
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
const node_html_markdown_1 = require("node-html-markdown");
const __1 = require("../");
const fetchFavicon_1 = require("../../util/fetchFavicon");
class URLContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        return await getUrlContextItems(query, extras.fetch);
    }
}
URLContextProvider.description = {
    title: "url",
    displayTitle: "URL",
    description: "Reference a webpage at a given URL",
    type: "query",
};
exports.default = URLContextProvider;
async function getUrlContextItems(query, fetchFn) {
    const url = new URL(query);
    const icon = await (0, fetchFavicon_1.fetchFavicon)(url);
    const resp = await fetchFn(url);
    // Check if the response is not OK
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    const html = await resp.text();
    const dom = new jsdom_1.JSDOM(html);
    let reader = new readability_1.Readability(dom.window.document);
    let article = reader.parse();
    const content = article?.content || "";
    const markdown = node_html_markdown_1.NodeHtmlMarkdown.translate(content, {}, undefined, undefined);
    const title = article?.title || url.pathname;
    return [
        {
            icon,
            description: url.toString(),
            content: markdown,
            name: title,
            uri: {
                type: "url",
                value: url.toString(),
            },
        },
    ];
}
//# sourceMappingURL=URLContextProvider.js.map