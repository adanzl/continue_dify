"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const walkDir_1 = require("../../indexing/walkDir");
const uri_1 = require("../../util/uri");
const MAX_SUBMENU_ITEMS = 10000;
class FileContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        // Assume the query is a filepath
        const fileUri = query.trim();
        const content = await extras.ide.readFile(fileUri);
        const { relativePathOrBasename, last2Parts, baseName } = (0, uri_1.getUriDescription)(fileUri, await extras.ide.getWorkspaceDirs());
        return [
            {
                name: baseName,
                description: last2Parts,
                content: `\`\`\`${relativePathOrBasename}\n${content}\n\`\`\``,
                uri: {
                    type: "file",
                    value: fileUri,
                },
            },
        ];
    }
    async loadSubmenuItems(args) {
        const workspaceDirs = await args.ide.getWorkspaceDirs();
        const results = await (0, walkDir_1.walkDirs)(args.ide, {
            source: "load submenu items - file",
        }, workspaceDirs);
        const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
        const withUniquePaths = (0, uri_1.getShortestUniqueRelativeUriPaths)(files, workspaceDirs);
        return withUniquePaths.map((file) => {
            return {
                id: file.uri,
                title: (0, uri_1.getUriPathBasename)(file.uri),
                description: file.uniquePath,
            };
        });
    }
}
FileContextProvider.description = {
    title: "file",
    displayTitle: "Files",
    description: "Type to search",
    type: "submenu",
};
exports.default = FileContextProvider;
//# sourceMappingURL=FileContextProvider.js.map