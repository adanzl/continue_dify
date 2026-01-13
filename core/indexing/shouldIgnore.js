"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldIgnore = shouldIgnore;
const ignore_1 = __importDefault(require("ignore"));
const uri_1 = require("../util/uri");
const continueignore_1 = require("./continueignore");
const ignore_2 = require("./ignore");
const walkDir_1 = require("./walkDir");
/*
    Process:
    1. Check global/default ignores
    2. Walk UP tree from file, checking ignores at each level

    TODO there might be issues with symlinks here
*/
async function shouldIgnore(fileUri, ide, rootDirCandidates) {
    const rootDirUris = rootDirCandidates ?? (await ide.getWorkspaceDirs());
    const { foundInDir: rootDir, uri } = (0, uri_1.findUriInDirs)(fileUri, rootDirUris);
    if (!rootDir) {
        return true;
    }
    const defaultAndGlobalIgnores = (0, ignore_1.default)()
        .add(ignore_2.defaultIgnoreFileAndDir)
        .add((0, continueignore_1.getGlobalContinueIgArray)());
    let currentDir = uri;
    let directParent = true;
    let fileType = 1;
    while (currentDir !== rootDir) {
        // Go to parent dir of file
        const splitUri = currentDir.split("/");
        splitUri.pop();
        currentDir = splitUri.join("/");
        // Get all files in the dir
        const dirEntries = await ide.listDir(currentDir);
        // Check if the file is a symbolic link, ignore if so
        if (directParent) {
            directParent = false;
            const baseName = (0, uri_1.getUriPathBasename)(fileUri);
            const entry = dirEntries.find(([name, _]) => name === baseName);
            if (entry) {
                fileType = entry[1];
                if (fileType === 64) {
                    return true;
                }
            }
        }
        const ignoreContext = await (0, walkDir_1.getIgnoreContext)(currentDir, dirEntries, ide, defaultAndGlobalIgnores);
        let relativePath = uri.substring(currentDir.length + 1);
        if (fileType === 2) {
            relativePath += "/";
        }
        if (ignoreContext.ignores(relativePath)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=shouldIgnore.js.map