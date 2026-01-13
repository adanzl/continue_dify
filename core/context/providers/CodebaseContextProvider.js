"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const retrieval_1 = require("../retrieval/retrieval");
class CodebaseContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        return (0, retrieval_1.retrieveContextItemsFromEmbeddings)(extras, this.options, undefined);
    }
    async load() { }
}
CodebaseContextProvider.description = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
    renderInlineAs: "",
    dependsOnIndexing: ["embeddings", "fullTextSearch", "chunk"],
};
exports.default = CodebaseContextProvider;
//# sourceMappingURL=CodebaseContextProvider.js.map