"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWebTool = void 0;
const builtIn_1 = require("../builtIn");
exports.searchWebTool = {
    type: "function",
    displayTitle: "Search Web",
    wouldLikeTo: 'search the web for "{{{ query }}}"',
    isCurrently: 'searching the web for "{{{ query }}}"',
    hasAlready: 'searched the web for "{{{ query }}}"',
    readonly: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.SearchWeb,
        description: "Performs a web search, returning top results. Use this tool sparingly - only for questions that require specialized, external, and/or up-to-date knowledege. Common programming questions do not require web search.",
        parameters: {
            type: "object",
            required: ["query"],
            properties: {
                query: {
                    type: "string",
                    description: "The natural language search query",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithoutPermission",
    systemMessageDescription: {
        prefix: `To search the web, use the ${builtIn_1.BuiltInToolNames.SearchWeb} tool with a natural language query. For example, to search for the current weather, you would respond with:`,
        exampleArgs: [["query", "What is the current weather in San Francisco?"]],
    },
    toolCallIcon: "GlobeAltIcon",
};
//# sourceMappingURL=searchWeb.js.map