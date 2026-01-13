"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCurrentlyOpenFileTool = void 0;
const builtIn_1 = require("../builtIn");
exports.readCurrentlyOpenFileTool = {
    type: "function",
    displayTitle: "Read Currently Open File",
    wouldLikeTo: "read the current file",
    isCurrently: "reading the current file",
    hasAlready: "read the current file",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.ReadCurrentlyOpenFile,
        description: "Read the currently open file in the IDE. If the user seems to be referring to a file that you can't see, or is requesting an action on content that seems missing, try using this tool.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    defaultToolPolicy: "allowedWithPermission",
    systemMessageDescription: {
        prefix: `To view the user's currently open file, use the ${builtIn_1.BuiltInToolNames.ReadCurrentlyOpenFile} tool.
If the user is asking about a file and you don't see any code, use this to check the current file`,
    },
    toolCallIcon: "DocumentTextIcon",
};
//# sourceMappingURL=readCurrentlyOpenFile.js.map