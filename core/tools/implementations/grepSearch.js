"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grepSearchImpl = void 0;
const errors_1 = require("../../util/errors");
const grepSearch_1 = require("../../util/grepSearch");
const regexValidator_1 = require("../../util/regexValidator");
const parseArgs_1 = require("../parseArgs");
const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 7500; // ~1500 tokens, will keep truncation simply for now
function splitGrepResultsByFile(content) {
    const matches = [...content.matchAll(/^\.\/([^\n]+)$/gm)];
    const contextItems = [];
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const filepath = match[1];
        const startIndex = match.index;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index : content.length;
        // Extract grepped content for this file
        const fileContent = content
            .substring(startIndex, endIndex)
            .replace(/^\.\/[^\n]+\n/, "") // remove the line with file path
            .trim();
        if (fileContent) {
            contextItems.push({
                name: `Search results in ${filepath}`,
                description: `Grep search results from ${filepath}`,
                content: fileContent,
                uri: { type: "file", value: filepath },
            });
        }
    }
    return contextItems;
}
const grepSearchImpl = async (args, extras) => {
    const rawQuery = (0, parseArgs_1.getStringArg)(args, "query");
    const { query, warning } = (0, regexValidator_1.prepareQueryForRipgrep)(rawQuery);
    let results;
    try {
        results = await extras.ide.getSearchResults(query, DEFAULT_GREP_SEARCH_RESULTS_LIMIT);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Helpful error for common ripgrep exit code
        if (errorMessage.includes("Process exited with code 2")) {
            return [
                {
                    name: "Search error",
                    description: "The search query could not be processed",
                    content: `The search failed due to an invalid regex pattern.\n\nOriginal query: ${rawQuery}\nProcessed query: ${query}\n\nError: ${errorMessage}\n\nTip: If you're searching for literal text with special characters, the query was automatically escaped. If you need regex patterns, ensure they use proper regex syntax.`,
                },
            ];
        }
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.SearchExecutionFailed, errorMessage);
    }
    const { formatted, numResults, truncated } = (0, grepSearch_1.formatGrepSearchResults)(results, DEFAULT_GREP_SEARCH_CHAR_LIMIT);
    if (numResults === 0) {
        return [
            {
                name: "Search results",
                description: "Results from grep search",
                content: "The search returned no results.",
            },
        ];
    }
    const truncationReasons = [];
    if (numResults === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
        truncationReasons.push(`the number of results exceeded ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}`);
    }
    if (truncated) {
        truncationReasons.push(`the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}`);
    }
    let contextItems;
    const splitByFile = args?.splitByFile || false;
    if (splitByFile) {
        contextItems = splitGrepResultsByFile(formatted);
    }
    else {
        contextItems = [
            {
                name: "Search results",
                description: "Results from grep search",
                content: formatted,
            },
        ];
    }
    // Add warnings about query modifications or truncation
    const warnings = [];
    if (warning) {
        warnings.push(warning);
    }
    if (truncationReasons.length > 0) {
        warnings.push(`Results were truncated because ${truncationReasons.join(" and ")}`);
    }
    if (truncationReasons.length > 0) {
        contextItems.push({
            name: "Truncation warning",
            description: "",
            content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
        });
    }
    return contextItems;
};
exports.grepSearchImpl = grepSearchImpl;
//# sourceMappingURL=grepSearch.js.map