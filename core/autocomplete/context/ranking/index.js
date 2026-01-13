"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSymbolsForSnippet = getSymbolsForSnippet;
exports.rankAndOrderSnippets = rankAndOrderSnippets;
exports.fillPromptWithSnippets = fillPromptWithSnippets;
const countTokens_1 = require("../../../llm/countTokens");
const rx = /[\s.,\/#!$%\^&\*;:{}=\-_`~()\[\]]/g;
function getSymbolsForSnippet(snippet) {
    const symbols = snippet
        .split(rx)
        .map((s) => s.trim())
        .filter((s) => s !== "");
    return new Set(symbols);
}
/**
 * Calculate similarity as number of shared symbols divided by total number of unique symbols between both.
 */
function jaccardSimilarity(a, b) {
    const aSet = getSymbolsForSnippet(a);
    const bSet = getSymbolsForSnippet(b);
    const union = new Set([...aSet, ...bSet]).size;
    // Avoid division by zero
    if (union === 0) {
        return 0;
    }
    let intersection = 0;
    for (const symbol of aSet) {
        if (bSet.has(symbol)) {
            intersection++;
        }
    }
    return intersection / union;
}
/**
 * Rank code snippets to be used in tab-autocomplete prompt. Returns a sorted version of the snippet array.
 */
function rankAndOrderSnippets(ranges, helper) {
    const windowAroundCursor = helper.fullPrefix.slice(-helper.options.slidingWindowSize *
        helper.options.slidingWindowPrefixPercentage) +
        helper.fullSuffix.slice(helper.options.slidingWindowSize *
            (1 - helper.options.slidingWindowPrefixPercentage));
    const snippets = ranges.map((snippet) => ({
        score: snippet.score ??
            jaccardSimilarity(snippet.contents, windowAroundCursor),
        ...snippet,
    }));
    const uniqueSnippets = deduplicateSnippets(snippets);
    return uniqueSnippets.sort((a, b) => a.score - b.score);
}
/**
 * Deduplicate code snippets by merging overlapping ranges into a single range.
 */
function deduplicateSnippets(snippets) {
    // Group by file
    const fileGroups = {};
    for (const snippet of snippets) {
        if (!fileGroups[snippet.filepath]) {
            fileGroups[snippet.filepath] = [];
        }
        fileGroups[snippet.filepath].push(snippet);
    }
    // Merge overlapping ranges
    const allRanges = [];
    for (const file of Object.keys(fileGroups)) {
        allRanges.push(...mergeSnippetsByRange(fileGroups[file]));
    }
    return allRanges;
}
function mergeSnippetsByRange(snippets) {
    if (snippets.length <= 1) {
        return snippets;
    }
    const sorted = snippets.sort((a, b) => a.range.start.line - b.range.start.line);
    const merged = [];
    while (sorted.length > 0) {
        const next = sorted.shift();
        const last = merged[merged.length - 1];
        if (merged.length > 0 && last.range.end.line >= next.range.start.line) {
            // Merge with previous snippet
            last.score = Math.max(last.score, next.score);
            try {
                last.range.end = next.range.end;
            }
            catch (e) {
                console.log("Error merging ranges", e);
            }
            last.contents = mergeOverlappingRangeContents(last, next);
        }
        else {
            merged.push(next);
        }
    }
    return merged;
}
function mergeOverlappingRangeContents(first, second) {
    const firstLines = first.contents.split("\n");
    const numOverlapping = first.range.end.line - second.range.start.line;
    return `${firstLines.slice(-numOverlapping).join("\n")}\n${second.contents}`;
}
/**
 * Fill the allowed space with snippets.
 * It is assumed that the snippets are sorted by score.
 */
function fillPromptWithSnippets(snippets, maxSnippetTokens, modelName) {
    let tokensRemaining = maxSnippetTokens;
    const keptSnippets = [];
    for (let i = 0; i < snippets.length; i++) {
        const snippet = snippets[i];
        const tokenCount = (0, countTokens_1.countTokens)(snippet.contents, modelName);
        if (tokensRemaining - tokenCount >= 0) {
            tokensRemaining -= tokenCount;
            keptSnippets.push(snippet);
        }
        else {
        }
    }
    return keptSnippets;
}
//# sourceMappingURL=index.js.map