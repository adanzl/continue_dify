"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CodeSnippetsIndex_js_1 = require("../../indexing/CodeSnippetsIndex.js");
const index_js_1 = require("../index.js");
const MAX_SUBMENU_ITEMS = 10000;
class CodeContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        // Assume the query is the id as returned by loadSubmenuItems
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        return [
            await CodeSnippetsIndex_js_1.CodeSnippetsCodebaseIndex.getForId(Number.parseInt(query, 10), workspaceDirs),
        ];
    }
    async loadSubmenuItems(args) {
        // TODO: Dynamically load submenu items based on the query
        // instead of loading everything into memory
        const tags = await args.ide.getTags("codeSnippets");
        const snippets = await Promise.all(tags.map((tag) => CodeSnippetsIndex_js_1.CodeSnippetsCodebaseIndex.getAll(tag)));
        const submenuItems = [];
        for (const snippetList of snippets.slice(-MAX_SUBMENU_ITEMS)) {
            submenuItems.push(...snippetList);
        }
        return submenuItems;
    }
}
CodeContextProvider.description = {
    title: "code",
    displayTitle: "Code",
    description: "Type to search",
    type: "submenu",
    dependsOnIndexing: ["chunk", "codeSnippets"],
};
exports.default = CodeContextProvider;
//# sourceMappingURL=CodeContextProvider.js.map