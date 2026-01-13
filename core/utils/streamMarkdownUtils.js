"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldStopAtMarkdownBlock = shouldStopAtMarkdownBlock;
exports.processBlockNesting = processBlockNesting;
exports.stopAtLinesWithMarkdownSupport = stopAtLinesWithMarkdownSupport;
const markdownUtils_1 = require("./markdownUtils");
/**
 * Determines if we should stop at a markdown block based on nested markdown logic.
 * This handles the complex case where markdown blocks contain other markdown blocks.
 * Uses optimized state tracking to avoid redundant computation.
 */
function shouldStopAtMarkdownBlock(stateTracker, currentIndex) {
    return stateTracker.shouldStopAtPosition(currentIndex);
}
/**
 * Processes block nesting logic and returns updated state.
 */
function processBlockNesting(line, seenFirstFence, shouldRemoveLineBeforeStart) {
    if (!seenFirstFence && shouldRemoveLineBeforeStart(line)) {
        return { newSeenFirstFence: false, shouldSkip: true };
    }
    if (!seenFirstFence) {
        return { newSeenFirstFence: true, shouldSkip: false };
    }
    return { newSeenFirstFence: seenFirstFence, shouldSkip: false };
}
/**
 * Stream transformation that stops when encountering a markdown code block ending.
 * Handles nested markdown blocks in markdown files.
 */
async function* stopAtLinesWithMarkdownSupport(lines, filename) {
    if (!(0, markdownUtils_1.isMarkdownFile)(filename)) {
        for await (const line of lines) {
            if (line.trim() === "```") {
                return;
            }
            yield line;
        }
        return;
    }
    const allLines = [];
    for await (const line of lines) {
        allLines.push(line);
    }
    const source = allLines.join("\n");
    if (!source.match(/```(\w*|.*)(md|markdown|gfm|github-markdown)/)) {
        // No nested markdown blocks detected, check for simple ``` stopping condition
        let foundStandaloneBackticks = false;
        for (let i = 0; i < allLines.length; i++) {
            if (allLines[i].trim() === "```") {
                // Found standalone backticks, yield lines up to this point
                for (let j = 0; j < i; j++) {
                    yield allLines[j];
                }
                foundStandaloneBackticks = true;
                return;
            }
        }
        // No standalone backticks found, yield all lines
        if (!foundStandaloneBackticks) {
            for (const line of allLines) {
                yield line;
            }
        }
        return;
    }
    // Use optimized state tracker for markdown block analysis
    const stateTracker = new markdownUtils_1.MarkdownBlockStateTracker(allLines);
    for (let i = 0; i < allLines.length; i++) {
        if (stateTracker.shouldStopAtPosition(i)) {
            for (let j = 0; j < i; j++) {
                yield allLines[j];
            }
            return;
        }
    }
    // If we get here, yield all lines
    for (const line of allLines) {
        yield line;
    }
}
//# sourceMappingURL=streamMarkdownUtils.js.map