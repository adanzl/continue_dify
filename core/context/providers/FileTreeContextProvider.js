"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const walkDir_js_1 = require("../../indexing/walkDir.js");
const uri_js_1 = require("../../util/uri.js");
const index_js_1 = require("../index.js");
function formatFileTree(tree, indentation = "") {
    let result = "";
    for (const file of tree.files) {
        result += `${indentation}${file}\n`;
    }
    for (const directory of tree.directories) {
        result += `${indentation}${directory.name}/\n`;
        result += formatFileTree(directory, `${indentation}  `);
    }
    return result;
}
class FileTreeContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        const trees = [];
        for (const workspaceDir of workspaceDirs) {
            const subDirTree = {
                name: (0, uri_js_1.getUriPathBasename)(workspaceDir),
                files: [],
                directories: [],
            };
            const uris = await (0, walkDir_js_1.walkDir)(workspaceDir, extras.ide, {
                source: "get context items - file tree",
            });
            const relativePaths = uris.map((uri) => (0, uri_js_1.findUriInDirs)(uri, [workspaceDir]).relativePathOrBasename);
            for (const path of relativePaths) {
                const parts = path.split("/");
                let currentTree = subDirTree;
                for (const part of parts.slice(0, -1)) {
                    if (!currentTree.directories.some((d) => d.name === part)) {
                        currentTree.directories.push({
                            name: part,
                            files: [],
                            directories: [],
                        });
                    }
                    currentTree = currentTree.directories.find((d) => d.name === part);
                }
                currentTree.files.push(parts.pop());
            }
            trees.push(formatFileTree(subDirTree));
        }
        return [
            {
                content: `Here is a file tree of the current workspace:\n\n${trees.join("\n\n")}`,
                name: "File Tree",
                description: "File Tree",
            },
        ];
    }
}
FileTreeContextProvider.description = {
    title: "tree",
    displayTitle: "File Tree",
    description: "Attach a representation of the file tree",
    type: "normal",
    renderInlineAs: "",
};
exports.default = FileTreeContextProvider;
//# sourceMappingURL=FileTreeContextProvider.js.map