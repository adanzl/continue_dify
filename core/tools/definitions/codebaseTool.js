"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codebaseTool = void 0;
const builtIn_1 = require("../builtIn");
exports.codebaseTool = {
    type: "function",
    displayTitle: "Codebase Search",
    wouldLikeTo: "search the codebase for: {{{ query }}}",
    isCurrently: "searching the codebase for: {{{ query }}}",
    hasAlready: "searched the codebase for: {{{ query }}}",
    readonly: true,
    isInstant: false,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.CodebaseTool,
        description: "Use this tool to semantically search through the codebase and retrieve relevant code snippets based on a natural language query. This helps find relevant code context for understanding or working with the codebase.",
        parameters: {
            type: "object",
            required: ["query"],
            properties: {
                query: {
                    type: "string",
                    description: "Natural language description of what you're looking for in the codebase (e.g., 'authentication logic', 'database connection setup', 'error handling')",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithPermission",
    systemMessageDescription: {
        prefix: `To search the codebase, use the ${builtIn_1.BuiltInToolNames.CodebaseTool} tool with a natural language query. For example, to find authentication logic, you might respond with:`,
        exampleArgs: [
            ["query", "How is user authentication handled in this codebase?"],
        ],
    },
};
//# sourceMappingURL=codebaseTool.js.map