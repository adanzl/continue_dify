"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const walkDir_js_1 = require("../../indexing/walkDir.js");
const uri_js_1 = require("../../util/uri.js");
const index_js_1 = require("../index.js");
const retrieval_js_1 = require("../retrieval/retrieval.js");
class FolderContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        return (0, retrieval_js_1.retrieveContextItemsFromEmbeddings)(extras, this.options, query);
    }
    async loadSubmenuItems(args) {
        const workspaceDirs = await args.ide.getWorkspaceDirs();
        const folders = await (0, walkDir_js_1.walkDirs)(args.ide, {
            include: "dirs",
            source: "load submenu items - folder",
        }, workspaceDirs);
        const withUniquePaths = (0, uri_js_1.getShortestUniqueRelativeUriPaths)(folders, workspaceDirs);
        return withUniquePaths.map((folder) => {
            return {
                id: folder.uri,
                title: (0, uri_js_1.getUriPathBasename)(folder.uri),
                description: folder.uniquePath,
            };
        });
    }
}
FolderContextProvider.description = {
    title: "folder",
    displayTitle: "Folder",
    description: "Type to search",
    type: "submenu",
    dependsOnIndexing: ["embeddings", "fullTextSearch", "chunk"],
};
exports.default = FolderContextProvider;
//# sourceMappingURL=FolderContextProvider.js.map