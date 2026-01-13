"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldPrefilter = shouldPrefilter;
const ignore_1 = __importDefault(require("ignore"));
const continueignore_1 = require("../../indexing/continueignore");
const paths_1 = require("../../util/paths");
const uri_1 = require("../../util/uri");
async function isDisabledForFile(currentFilepath, disableInFiles, ide) {
    if (disableInFiles) {
        // Relative path needed for `ignore`
        const workspaceDirs = await ide.getWorkspaceDirs();
        const { relativePathOrBasename } = (0, uri_1.findUriInDirs)(currentFilepath, workspaceDirs);
        // @ts-ignore
        const pattern = ignore_1.default.default().add(disableInFiles);
        if (pattern.ignores(relativePathOrBasename)) {
            return true;
        }
    }
}
async function shouldLanguageSpecificPrefilter(helper) {
    const line = helper.fileLines[helper.pos.line] ?? "";
    for (const endOfLine of helper.lang.endOfLine) {
        if (line.endsWith(endOfLine) && helper.pos.character >= line.length) {
            return true;
        }
    }
}
async function shouldPrefilter(helper, ide) {
    // Allow disabling autocomplete from config.json
    if (helper.options.disable) {
        return true;
    }
    // Check whether we're in the continue config.json file
    if (helper.filepath === (0, paths_1.getConfigJsonPath)()) {
        return true;
    }
    // Check whether autocomplete is disabled for this file
    const disableInFiles = [
        ...(helper.options.disableInFiles ?? []),
        "*.prompt",
        ...(0, continueignore_1.getGlobalContinueIgArray)(),
        ...(await (0, continueignore_1.getWorkspaceContinueIgArray)(ide)),
    ];
    if (await isDisabledForFile(helper.filepath, disableInFiles, ide)) {
        return true;
    }
    // Don't offer completions when we have no information (untitled file and no file contents)
    if (helper.filepath.includes("Untitled") &&
        helper.fileContents.trim() === "") {
        return true;
    }
    // if (
    //   helper.options.transform &&
    //   (await shouldLanguageSpecificPrefilter(helper))
    // ) {
    //   return true;
    // }
    return false;
}
//# sourceMappingURL=index.js.map