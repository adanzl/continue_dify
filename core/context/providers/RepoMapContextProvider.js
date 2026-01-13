"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const walkDir_1 = require("../../indexing/walkDir");
const generateRepoMap_1 = __importDefault(require("../../util/generateRepoMap"));
const uri_1 = require("../../util/uri");
const ENTIRE_PROJECT_ITEM = {
    id: "entire-codebase",
    title: "Entire codebase",
    description: "Search the entire codebase",
};
class RepoMapContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        return [
            {
                name: "Repository Map",
                description: "Overview of the repository structure",
                content: await (0, generateRepoMap_1.default)(extras.llm, extras.ide, {
                    dirUris: query === ENTIRE_PROJECT_ITEM.id ? undefined : [query],
                    outputRelativeUriPaths: true,
                    // Doesn't ALWAYS depend on indexing, so not setting dependsOnIndexing = true, just checking for it
                    includeSignatures: extras.config.disableIndexing
                        ? false
                        : (this.options?.includeSignatures ?? true),
                }),
            },
        ];
    }
    async loadSubmenuItems(args) {
        const workspaceDirs = await args.ide.getWorkspaceDirs();
        const folders = await (0, walkDir_1.walkDirs)(args.ide, {
            include: "dirs",
            source: "load submenu items - repo map",
        }, workspaceDirs);
        const withUniquePaths = (0, uri_1.getShortestUniqueRelativeUriPaths)(folders, workspaceDirs);
        return [
            ENTIRE_PROJECT_ITEM,
            ...withUniquePaths.map((folder) => ({
                id: folder.uri,
                title: (0, uri_1.getUriPathBasename)(folder.uri),
                description: folder.uniquePath,
            })),
        ];
    }
}
RepoMapContextProvider.description = {
    title: "repo-map",
    displayTitle: "Repository Map",
    description: "Select a folder",
    type: "submenu",
};
exports.default = RepoMapContextProvider;
//# sourceMappingURL=RepoMapContextProvider.js.map