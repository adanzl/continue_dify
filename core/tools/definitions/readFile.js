"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileTool = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const builtIn_1 = require("../builtIn");
const fileAccess_1 = require("../policies/fileAccess");
exports.readFileTool = {
    type: "function",
    displayTitle: "Read File",
    wouldLikeTo: "read {{{ filepath }}}",
    isCurrently: "reading {{{ filepath }}}",
    hasAlready: "read {{{ filepath }}}",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.ReadFile,
        description: "Use this tool if you need to view the contents of an existing file.",
        parameters: {
            type: "object",
            required: ["filepath"],
            properties: {
                filepath: {
                    type: "string",
                    description: "The path of the file to read. Can be a relative path (from workspace root), absolute path, tilde path (~/...), or file:// URI",
                },
            },
        },
    },
    systemMessageDescription: {
        prefix: `To read a file with a known filepath, use the ${builtIn_1.BuiltInToolNames.ReadFile} tool. For example, to read a file located at 'path/to/file.txt', you would respond with this:`,
        exampleArgs: [["filepath", "path/to/the_file.txt"]],
    },
    defaultToolPolicy: "allowedWithoutPermission",
    toolCallIcon: "DocumentIcon",
    preprocessArgs: async (args, { ide }) => {
        const filepath = args.filepath;
        const resolvedPath = await (0, pathResolver_1.resolveInputPath)(ide, filepath);
        // Store the resolved path info in args for policy evaluation
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
//# sourceMappingURL=readFile.js.map