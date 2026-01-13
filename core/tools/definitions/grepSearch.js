"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grepSearchTool = void 0;
const builtIn_1 = require("../builtIn");
exports.grepSearchTool = {
    type: "function",
    displayTitle: "Grep Search",
    wouldLikeTo: 'search for "{{{ query }}}"',
    isCurrently: 'searching for "{{{ query }}}"',
    hasAlready: 'searched for "{{{ query }}}"',
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.GrepSearch,
        description: "Performs a regular expression (regex) search over the repository using ripgrep. Will not include results for many build, cache, secrets dirs/files. Output may be truncated, so use targeted queries",
        parameters: {
            type: "object",
            required: ["query"],
            properties: {
                query: {
                    type: "string",
                    description: "The regex pattern to search for within file contents. Use regex with alternation (e.g., 'word1|word2|word3') or character classes to find multiple potential words in a single search.",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithoutPermission",
    systemMessageDescription: {
        prefix: `To perform a grep search within the project, call the ${builtIn_1.BuiltInToolNames.GrepSearch} tool with the query pattern to match. For example:`,
        exampleArgs: [["query", ".*main_services.*"]],
    },
    toolCallIcon: "MagnifyingGlassIcon",
};
//# sourceMappingURL=grepSearch.js.map