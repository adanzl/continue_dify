"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lsToolImpl = void 0;
exports.resolveLsToolDirPath = resolveLsToolDirPath;
const ignore_1 = __importDefault(require("ignore"));
const walkDir_1 = require("../../indexing/walkDir");
const pathResolver_1 = require("../../util/pathResolver");
const errors_1 = require("../../util/errors");
function resolveLsToolDirPath(dirPath) {
    if (!dirPath || dirPath === ".") {
        return "/";
    }
    // Don't strip leading slash from absolute paths - let the resolver handle it
    if (dirPath.startsWith(".") && !dirPath.startsWith("./")) {
        return dirPath.slice(1);
    }
    return dirPath.replace(/\\/g, "/");
}
const MAX_LS_TOOL_LINES = 200;
const lsToolImpl = async (args, extras) => {
    const dirPath = resolveLsToolDirPath(args?.dirPath);
    const resolvedPath = await (0, pathResolver_1.resolveInputPath)(extras.ide, dirPath);
    if (!resolvedPath) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.DirectoryNotFound, `Directory ${args.dirPath} not found or is not accessible. You can use absolute paths, relative paths, or paths starting with ~`);
    }
    const entries = await (0, walkDir_1.walkDir)(resolvedPath.uri, extras.ide, {
        returnRelativeUrisPaths: true,
        include: "both",
        recursive: args?.recursive ?? false,
        overrideDefaultIgnores: (0, ignore_1.default)(), // Show all directories including dist/, build/, etc.
    });
    const lines = entries.slice(0, MAX_LS_TOOL_LINES);
    let content = lines.length > 0
        ? lines.join("\n")
        : `No files/folders found in ${resolvedPath.displayPath}`;
    const contextItems = [
        {
            name: "File/folder list",
            description: `Files/folders in ${resolvedPath.displayPath}`,
            content,
        },
    ];
    if (entries.length > MAX_LS_TOOL_LINES) {
        let warningContent = `${entries.length - MAX_LS_TOOL_LINES} ls entries were truncated`;
        if (args?.recursive) {
            warningContent += ". Try using a non-recursive search";
        }
        contextItems.push({
            name: "Truncation warning",
            description: "",
            content: warningContent,
        });
    }
    return contextItems;
};
exports.lsToolImpl = lsToolImpl;
//# sourceMappingURL=lsTool.js.map