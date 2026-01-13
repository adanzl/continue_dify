"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileGlobSearchImpl = void 0;
const parseArgs_1 = require("../parseArgs");
const MAX_AGENT_GLOB_RESULTS = 100;
const fileGlobSearchImpl = async (args, extras) => {
    const pattern = (0, parseArgs_1.getStringArg)(args, "pattern");
    const results = await extras.ide.getFileResults(pattern, MAX_AGENT_GLOB_RESULTS);
    if (results.length === 0) {
        return [
            {
                name: "File results",
                description: "glob search",
                content: "The glob search returned no results.",
            },
        ];
    }
    const contextItems = [
        {
            name: "File results",
            description: "glob search",
            content: results.join("\n"),
        },
    ];
    // In case of truncation, add a warning
    if (results.length === MAX_AGENT_GLOB_RESULTS) {
        contextItems.push({
            name: "Truncation warning",
            description: "",
            content: `Warning: the results above were truncated to the first ${MAX_AGENT_GLOB_RESULTS} files. If the results are not satisfactory, refine your search pattern`,
        });
    }
    return contextItems;
};
exports.fileGlobSearchImpl = fileGlobSearchImpl;
//# sourceMappingURL=globSearch.js.map