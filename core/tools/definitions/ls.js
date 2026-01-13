"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lsTool = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const builtIn_1 = require("../builtIn");
const fileAccess_1 = require("../policies/fileAccess");
exports.lsTool = {
    type: "function",
    displayTitle: "ls",
    wouldLikeTo: "list files in {{{ dirPath }}}",
    isCurrently: "listing files in {{{ dirPath }}}",
    hasAlready: "listed files in {{{ dirPath }}}",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.LSTool,
        description: "List files and folders in a given directory",
        parameters: {
            type: "object",
            properties: {
                dirPath: {
                    type: "string",
                    description: "The directory path. Can be relative to project root, absolute path, tilde path (~/...), or file:// URI. Use forward slash paths",
                },
                recursive: {
                    type: "boolean",
                    description: "If true, lists files and folders recursively. To prevent unexpected large results, use this sparingly",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithoutPermission",
    systemMessageDescription: {
        prefix: `To list files and folders in a given directory, call the ${builtIn_1.BuiltInToolNames.LSTool} tool with "dirPath" and "recursive". For example:`,
        exampleArgs: [
            ["dirPath", "path/to/dir"],
            ["recursive", "false"],
        ],
    },
    toolCallIcon: "FolderIcon",
    preprocessArgs: async (args, { ide }) => {
        const dirPath = args.dirPath;
        // Default to current directory if no path provided
        const pathToResolve = dirPath || ".";
        const resolvedPath = await (0, pathResolver_1.resolveInputPath)(ide, pathToResolve);
        return {
            resolvedPath,
        };
    },
    evaluateToolCallPolicy: (basePolicy, _, processedArgs) => {
        const resolvedPath = processedArgs?.resolvedPath;
        if (!resolvedPath)
            return basePolicy;
        return (0, fileAccess_1.evaluateFileAccessPolicy)(basePolicy, resolvedPath.isWithinWorkspace);
    },
};
//# sourceMappingURL=ls.js.map