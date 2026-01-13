"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewDiffTool = void 0;
const builtIn_1 = require("../builtIn");
exports.viewDiffTool = {
    type: "function",
    displayTitle: "View Diff",
    wouldLikeTo: "view the git diff",
    isCurrently: "getting the git diff",
    hasAlready: "viewed the git diff",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.ViewDiff,
        description: "View the current diff of working changes",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    systemMessageDescription: {
        prefix: `To view the current git diff, use the ${builtIn_1.BuiltInToolNames.ViewDiff} tool. This will show you the changes made in the working directory compared to the last commit.`,
    },
    defaultToolPolicy: "allowedWithoutPermission",
    toolCallIcon: "CodeBracketIcon",
};
//# sourceMappingURL=viewDiff.js.map