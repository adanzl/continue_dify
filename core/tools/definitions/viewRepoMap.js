"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewRepoMapTool = void 0;
const builtIn_1 = require("../builtIn");
exports.viewRepoMapTool = {
    type: "function",
    displayTitle: "View Repo Map",
    wouldLikeTo: "view the repository map",
    isCurrently: "getting the repository map",
    hasAlready: "viewed the repository map",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.ViewRepoMap,
        description: "View the repository map",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    systemMessageDescription: {
        prefix: `To view the repository map, use the ${builtIn_1.BuiltInToolNames.ViewRepoMap} tool. This will provide a visual representation of the project's structure and organization.`,
    },
    defaultToolPolicy: "allowedWithPermission",
    toolCallIcon: "MapIcon",
};
//# sourceMappingURL=viewRepoMap.js.map