"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewSubdirectoryTool = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const builtIn_1 = require("../builtIn");
const fileAccess_1 = require("../policies/fileAccess");
exports.viewSubdirectoryTool = {
    type: "function",
    displayTitle: "View Subdirectory",
    wouldLikeTo: 'view a map of "{{{ directory_path }}}"',
    isCurrently: 'getting a map of "{{{ directory_path }}}"',
    hasAlready: 'viewed a map of "{{{ directory_path }}}"',
    readonly: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    isInstant: true,
    function: {
        name: builtIn_1.BuiltInToolNames.ViewSubdirectory,
        description: "View the contents of a subdirectory",
        parameters: {
            type: "object",
            required: ["directory_path"],
            properties: {
                directory_path: {
                    type: "string",
                    description: "The path of the subdirectory to view, relative to the root of the workspace",
                },
            },
        },
    },
    systemMessageDescription: {
        prefix: `To view a map of a specific folder within the project, you can use the ${builtIn_1.BuiltInToolNames.ViewSubdirectory} tool. This will provide a visual representation of the folder's structure and organization.`,
        exampleArgs: [["directory_path", "path/to/subdirectory"]],
    },
    defaultToolPolicy: "allowedWithPermission",
    toolCallIcon: "FolderOpenIcon",
    preprocessArgs: async (args, { ide }) => {
        const directoryPath = args.directory_path;
        const resolvedPath = await (0, pathResolver_1.resolveInputPath)(ide, directoryPath);
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
//# sourceMappingURL=viewSubdirectory.js.map