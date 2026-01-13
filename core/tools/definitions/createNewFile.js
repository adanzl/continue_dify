"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewFileTool = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const builtIn_1 = require("../builtIn");
const fileAccess_1 = require("../policies/fileAccess");
exports.createNewFileTool = {
    type: "function",
    displayTitle: "Create New File",
    wouldLikeTo: "create {{{ filepath }}}",
    isCurrently: "creating {{{ filepath }}}",
    hasAlready: "created {{{ filepath }}}",
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    readonly: false,
    isInstant: true,
    function: {
        name: builtIn_1.BuiltInToolNames.CreateNewFile,
        description: "Create a new file. Only use this when a file doesn't exist and should be created",
        parameters: {
            type: "object",
            required: ["filepath", "contents"],
            properties: {
                filepath: {
                    type: "string",
                    description: "The path where the new file should be created. Can be a relative path (from workspace root), absolute path, tilde path (~/...), or file:// URI.",
                },
                contents: {
                    type: "string",
                    description: "The contents to write to the new file",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithPermission",
    systemMessageDescription: {
        prefix: `To create a NEW file, use the ${builtIn_1.BuiltInToolNames.CreateNewFile} tool with the relative filepath and new contents. For example, to create a file located at 'path/to/file.txt', you would respond with:`,
        exampleArgs: [
            ["filepath", "path/to/the_file.txt"],
            ["contents", "Contents of the file"],
        ],
    },
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
//# sourceMappingURL=createNewFile.js.map