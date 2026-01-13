"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptFilesFromDir = getPromptFilesFromDir;
exports.getAllPromptFiles = getAllPromptFiles;
const path_1 = __importDefault(require("path"));
const _1 = require(".");
const walkDir_1 = require("../indexing/walkDir");
const paths_1 = require("../util/paths");
const uri_1 = require("../util/uri");
async function getPromptFilesFromDir(ide, dir) {
    try {
        const exists = await ide.fileExists(dir);
        if (!exists) {
            return [];
        }
        const uris = await (0, walkDir_1.walkDir)(dir, ide, {
            source: "get dir prompt files",
        });
        const promptFilePaths = uris.filter((p) => p.endsWith(".prompt") || p.endsWith(".md"));
        const results = promptFilePaths.map(async (uri) => {
            const content = await ide.readFile(uri); // make a try catch
            return { path: uri, content };
        });
        return Promise.all(results);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
async function getAllPromptFiles(ide, overridePromptFolder, checkV1DefaultFolder = false) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    let promptFiles = [];
    let dirsToCheck = [_1.DEFAULT_PROMPTS_FOLDER_V2, _1.DEFAULT_RULES_FOLDER];
    if (checkV1DefaultFolder) {
        dirsToCheck.push(_1.DEFAULT_PROMPTS_FOLDER_V1);
    }
    if (overridePromptFolder) {
        dirsToCheck = [overridePromptFolder];
    }
    const fullDirs = workspaceDirs
        .map((dir) => dirsToCheck.map((d) => (0, uri_1.joinPathsToUri)(dir, d)))
        .flat();
    promptFiles = (await Promise.all(fullDirs.map((dir) => getPromptFilesFromDir(ide, dir)))).flat();
    // Also read from ~/.continue/prompts and ~/.continue/rules
    promptFiles.push(...(0, paths_1.readAllGlobalPromptFiles)());
    const promptFilesFromRulesDirectory = (0, paths_1.readAllGlobalPromptFiles)(path_1.default.join((0, paths_1.getContinueGlobalPath)(), _1.RULES_DIR_NAME));
    promptFiles.push(...promptFilesFromRulesDirectory);
    const result = await Promise.all(promptFiles.map(async (file) => {
        const content = await ide.readFile(file.path);
        return { path: file.path, content };
    }));
    return result;
}
//# sourceMappingURL=getPromptFiles.js.map