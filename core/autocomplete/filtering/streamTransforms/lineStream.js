"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGLISH_POST_PHRASES = exports.ENGLISH_START_PHRASES = exports.LINES_TO_REMOVE_BEFORE_START = exports.LINES_TO_SKIP = exports.LINES_TO_STOP_AT = exports.PREFIXES_TO_SKIP = exports.BRACKET_ENDING_CHARS = exports.CODE_STOP_BLOCK = exports.CODE_KEYWORDS_ENDING_IN_SEMICOLON = exports.USELESS_LINES = exports.filterCodeBlockLines = void 0;
exports.validatePatternInLine = validatePatternInLine;
exports.shouldChangeLineAndStop = shouldChangeLineAndStop;
exports.hasNestedMarkdownBlocks = hasNestedMarkdownBlocks;
exports.processBlockNesting = processBlockNesting;
exports.noTopLevelKeywordsMidline = noTopLevelKeywordsMidline;
exports.avoidPathLine = avoidPathLine;
exports.avoidEmptyComments = avoidEmptyComments;
exports.streamWithNewLines = streamWithNewLines;
exports.lineIsRepeated = lineIsRepeated;
exports.stopAtSimilarLine = stopAtSimilarLine;
exports.stopAtLines = stopAtLines;
exports.stopAtLinesExact = stopAtLinesExact;
exports.skipPrefixes = skipPrefixes;
exports.skipLines = skipLines;
exports.removeTrailingWhitespace = removeTrailingWhitespace;
exports.filterEnglishLinesAtStart = filterEnglishLinesAtStart;
exports.filterEnglishLinesAtEnd = filterEnglishLinesAtEnd;
exports.filterLeadingNewline = filterLeadingNewline;
exports.fixCodeLlamaFirstLineIndentation = fixCodeLlamaFirstLineIndentation;
exports.filterLeadingAndTrailingNewLineInsertion = filterLeadingAndTrailingNewLineInsertion;
exports.stopAtRepeatingLines = stopAtRepeatingLines;
exports.logLines = logLines;
exports.showWhateverWeHaveAtXMs = showWhateverWeHaveAtXMs;
exports.noDoubleNewLine = noDoubleNewLine;
const fastest_levenshtein_1 = require("fastest-levenshtein");
const markdownUtils_1 = require("../../../utils/markdownUtils");
const streamMarkdownUtils_1 = require("../../../utils/streamMarkdownUtils");
var filterCodeBlock_1 = require("./filterCodeBlock");
Object.defineProperty(exports, "filterCodeBlockLines", { enumerable: true, get: function () { return filterCodeBlock_1.filterCodeBlockLines; } });
function isBracketEnding(line) {
    return line
        .trim()
        .split("")
        .some((char) => exports.BRACKET_ENDING_CHARS.includes(char));
}
function isEnglishFirstLine(line) {
    line = line.trim().toLowerCase();
    if (line.endsWith(":") &&
        !exports.CODE_KEYWORDS_ENDING_IN_SEMICOLON.some((keyword) => line.startsWith(keyword))) {
        return true;
    }
    return exports.ENGLISH_START_PHRASES.some((phrase) => line.startsWith(phrase));
}
function isEnglishPostExplanation(line) {
    const lower = line.toLowerCase();
    return exports.ENGLISH_POST_PHRASES.some((phrase) => lower.startsWith(phrase));
}
function shouldRemoveLineBeforeStart(line) {
    return (line.trimStart().startsWith("```") ||
        exports.LINES_TO_REMOVE_BEFORE_START.some((l) => line.trim() === l));
}
/**
 * Shared utility for validating patterns in lines to avoid code duplication.
 * Checks if a pattern appears in a valid context (not inside quotes or identifiers).
 */
function validatePatternInLine(line, pattern) {
    const patternIndex = line.indexOf(pattern);
    if (patternIndex === -1) {
        return { isValid: false, patternIndex: -1, beforePattern: "" };
    }
    // Check if pattern is preceded by a non-whitespace character
    // If so, it might be part of an identifier, so don't handle it
    if (patternIndex > 0) {
        const charBefore = line[patternIndex - 1];
        if (charBefore && !charBefore.match(/\s/)) {
            return { isValid: false, patternIndex, beforePattern: "" };
        }
    }
    // Check if pattern appears to be inside quotes
    // Simple heuristic: count unmatched quotes before the pattern
    const beforePattern = line.substring(0, patternIndex);
    const singleQuotes = (beforePattern.match(/'/g) || []).length;
    const doubleQuotes = (beforePattern.match(/"/g) || []).length;
    // If there's an odd number of quotes before pattern, we're likely inside quotes
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return { isValid: false, patternIndex, beforePattern };
    }
    return { isValid: true, patternIndex, beforePattern };
}
function shouldChangeLineAndStop(line) {
    if (line.trimStart() === "```") {
        return line;
    }
    // Check if [/CODE] appears in the line
    if (line.includes(exports.CODE_STOP_BLOCK)) {
        const validation = validatePatternInLine(line, exports.CODE_STOP_BLOCK);
        if (!validation.isValid) {
            return undefined;
        }
        // Get the trimmed line to check if [/CODE] is at logical start
        const trimmedLine = line.trimStart();
        if (trimmedLine.startsWith(exports.CODE_STOP_BLOCK)) {
            // [/CODE] is at the logical start (after whitespace only)
            if (trimmedLine === exports.CODE_STOP_BLOCK) {
                return line; // Return the whole line including leading whitespace
            }
        }
        // [/CODE] appears after some content (separated by whitespace) - return part before
        return validation.beforePattern.trimEnd();
    }
    return undefined;
}
function isUselessLine(line) {
    const trimmed = line.trim().toLowerCase();
    const hasUselessLine = exports.USELESS_LINES.some((uselessLine) => trimmed === uselessLine);
    return hasUselessLine || trimmed.startsWith("// end");
}
/**
 * Determines if the code block has nested markdown blocks.
 */
function hasNestedMarkdownBlocks(firstLine, filepath) {
    return ((firstLine.startsWith("```") &&
        (0, markdownUtils_1.headerIsMarkdown)(firstLine.replace(/`/g, ""))) ||
        Boolean(filepath && (0, markdownUtils_1.isMarkdownFile)(filepath)));
}
// Wrapper for processBlockNesting with local shouldRemoveLineBeforeStart function
function processBlockNesting(line, seenFirstFence) {
    return (0, streamMarkdownUtils_1.processBlockNesting)(line, seenFirstFence, shouldRemoveLineBeforeStart);
}
exports.USELESS_LINES = [""];
exports.CODE_KEYWORDS_ENDING_IN_SEMICOLON = ["def"];
exports.CODE_STOP_BLOCK = "[/CODE]";
exports.BRACKET_ENDING_CHARS = [")", "]", "}", ";"];
exports.PREFIXES_TO_SKIP = ["<COMPLETION>"];
exports.LINES_TO_STOP_AT = [
    "# End of file.",
    "<STOP EDITING HERE",
    "<|/updated_code|>",
    "```",
];
exports.LINES_TO_SKIP = ["</START EDITING HERE>", "<|updated_code|>"];
exports.LINES_TO_REMOVE_BEFORE_START = [
    "<COMPLETION>",
    "[CODE]",
    "<START EDITING HERE>",
    "{{FILL_HERE}}",
];
exports.ENGLISH_START_PHRASES = [
    "here is",
    "here's",
    "sure, here",
    "sure thing",
    "sure!",
    "to fill",
    "certainly",
    "of course",
    "the code should",
];
exports.ENGLISH_POST_PHRASES = [
    "explanation:",
    "here is",
    "here's how",
    "the above",
];
async function* noTopLevelKeywordsMidline(lines, topLevelKeywords, fullStop) {
    for await (const line of lines) {
        for (const keyword of topLevelKeywords) {
            const indexOf = line.indexOf(`${keyword} `);
            // TODO: What is this second clause for?
            if (indexOf >= 0 && line.slice(indexOf - 1, indexOf).trim() !== "") {
                yield line.slice(0, indexOf);
                fullStop();
                break;
            }
        }
        yield line;
    }
}
/**
 * Filters out lines starting with '// Path: <PATH>' from a LineStream.
 *
 * @param {LineStream} stream - The input stream of lines to filter.
 * @param {string} comment - The comment syntax to filter (e.g., '//' for JavaScript-style comments).
 * @yields {string} The filtered lines, excluding unwanted path lines.
 */
async function* avoidPathLine(stream, comment) {
    // Snippets are inserted as comments with a line at the start '// Path: <PATH>'.
    // Sometimes the model with copy this pattern, which is unwanted
    for await (const line of stream) {
        if (line.startsWith(`${comment} Path: `)) {
            continue; // continue in the Continue codebase! How meta!
        }
        yield line;
    }
}
/**
 * Filters out empty comment lines from a LineStream.
 *
 * @param {LineStream} stream - The input stream of lines to filter.
 * @param {string} comment - The comment syntax to filter (e.g., '//' for JavaScript-style comments).
 * @yields {string} The filtered lines, excluding empty comments.
 */
async function* avoidEmptyComments(stream, comment) {
    // Filter lines that are empty comments
    for await (const line of stream) {
        if (!comment || line.trim() !== comment) {
            yield line;
        }
    }
}
/**
 * Transforms a LineStream by adding newline characters between lines.
 *
 * @param {LineStream} stream - The input stream of lines.
 * @yields {string} The lines from the input stream with newline characters added between them.
 */
async function* streamWithNewLines(stream) {
    let firstLine = true;
    for await (const nextLine of stream) {
        if (!firstLine) {
            yield "\n";
        }
        firstLine = false;
        yield nextLine;
    }
}
/**
 * Determines if two lines of text are considered repeated or very similar.
 *
 * @param {string} a - The first line of text to compare.
 * @param {string} b - The second line of text to compare.
 * @returns {boolean} True if the lines are considered repeated, false otherwise.
 *
 * @description
 * This function checks if the Levenshtein distance between them is less than 10% of the length of the second line.
 * Lines shorter than 5 characters are never considered repeated.
 */
function lineIsRepeated(a, b) {
    if (a.length <= 4 || b.length <= 4) {
        return false;
    }
    const aTrim = a.trim();
    const bTrim = b.trim();
    return (0, fastest_levenshtein_1.distance)(aTrim, bTrim) / bTrim.length < 0.1;
}
/**
 * Filters a LineStream, stopping when a line similar to the provided one is encountered.
 *
 * @param {LineStream} stream - The input stream of lines to filter.
 * @param {string} line - The line to compare against for similarity.
 * @param {() => void} fullStop - Function to call when stopping the stream.
 * @yields {string} Filtered lines until a similar line is encountered.
 *
 * @description
 * This generator function processes the input stream, yielding lines until it encounters:
 * 1. An exact match to the provided line.
 * 2. A line that is considered repeated or very similar to the provided line.
 * 3. For lines ending with brackets, it allows exact matches of trimmed content.
 * When any of these conditions are met, it calls the fullStop function and stops yielding.
 */
async function* stopAtSimilarLine(stream, line, fullStop) {
    const trimmedLine = line.trim();
    const lineIsBracketEnding = isBracketEnding(trimmedLine);
    for await (const nextLine of stream) {
        if (trimmedLine === "") {
            yield nextLine;
            continue;
        }
        if (lineIsBracketEnding && trimmedLine.trim() === nextLine.trim()) {
            yield nextLine;
            continue;
        }
        if (nextLine === line) {
            fullStop();
            break;
        }
        if (lineIsRepeated(nextLine, trimmedLine)) {
            fullStop();
            break;
        }
        yield nextLine;
    }
}
/**
 * Filters a LineStream, stopping when a line contains any of the specified stop phrases.
 * @param {LineStream} stream - The input stream of lines.
 * @param {() => void} fullStop - Function to call when stopping.
 * @yields {string} Filtered lines until a stop phrase is encountered.
 */
async function* stopAtLines(stream, fullStop, linesToStopAt = exports.LINES_TO_STOP_AT) {
    for await (const line of stream) {
        let shouldStop = false;
        // Check each stop phrase
        for (const stopAt of linesToStopAt) {
            if (line.includes(stopAt)) {
                const validation = validatePatternInLine(line, stopAt);
                if (!validation.isValid) {
                    continue;
                }
                // Get the trimmed line to check if stop phrase is at logical start
                const trimmedLine = line.trimStart();
                if (trimmedLine.startsWith(stopAt)) {
                    // Stop phrase is at the logical start (after whitespace only) - should stop
                    shouldStop = true;
                    break;
                }
                else {
                    // Stop phrase appears after some content - check if it's separated by whitespace
                    const contentBeforeStopPhrase = validation.beforePattern.trimEnd();
                    if (contentBeforeStopPhrase.length < validation.beforePattern.length) {
                        // There's whitespace before the stop phrase, so it's properly separated
                        shouldStop = true;
                        break;
                    }
                    // If no whitespace separation, it's part of larger text, so continue
                }
            }
        }
        if (shouldStop) {
            fullStop();
            break;
        }
        yield line;
    }
}
async function* stopAtLinesExact(stream, fullStop, linesToStopAt) {
    for await (const line of stream) {
        if (linesToStopAt.some((stopAt) => line === stopAt)) {
            fullStop();
            break;
        }
        yield line;
    }
}
/**
 * Filters a LineStream, skipping specified prefixes on the first line.
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Filtered lines with prefixes removed from the first line if applicable.
 */
async function* skipPrefixes(lines) {
    let isFirstLine = true;
    for await (const line of lines) {
        if (isFirstLine) {
            const match = exports.PREFIXES_TO_SKIP.find((prefix) => line.startsWith(prefix));
            if (match) {
                yield line.slice(match.length);
                continue;
            }
            isFirstLine = false;
        }
        yield line;
    }
}
/**
 * Filters out lines starting with specified prefixes from a LineStream.
 * @param {LineStream} stream - The input stream of lines.
 * @yields {string} Filtered lines that don't start with any of the LINES_TO_SKIP prefixes.
 */
async function* skipLines(stream) {
    for await (const line of stream) {
        if (!exports.LINES_TO_SKIP.some((skipAt) => line.startsWith(skipAt))) {
            yield line;
        }
    }
}
/**
 * Handles cases where original lines have a trailing whitespace, but new lines do not.
 * @param {LineStream} stream - The input stream of lines.
 * @yields {string} Filtered lines that are stripped of trailing whitespace
 */
async function* removeTrailingWhitespace(stream) {
    for await (const line of stream) {
        yield line.trimEnd();
    }
}
/**
 * Filters out English explanations at the start of a code block.
 *
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Filtered lines with English explanations removed from the start.
 *
 * @description
 * This generator function performs the following tasks:
 * 1. Skips initial blank lines.
 * 2. Removes the first line if it's identified as an English explanation.
 * 3. Removes a subsequent blank line if the first line was an English explanation.
 * 4. Yields all remaining lines.
 */
async function* filterEnglishLinesAtStart(lines) {
    let i = 0;
    let wasEnglishFirstLine = false;
    for await (const line of lines) {
        if (i === 0 && line.trim() === "") {
            continue;
        }
        if (i === 0) {
            if (isEnglishFirstLine(line)) {
                wasEnglishFirstLine = true;
                i++;
                continue;
            }
        }
        else if (i === 1 && wasEnglishFirstLine && line.trim() === "") {
            i++;
            continue;
        }
        i++;
        yield line;
    }
}
/**
 * Filters out English explanations at the end of a code block.
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Lines up to the end of the code block or start of English explanation.
 */
async function* filterEnglishLinesAtEnd(lines) {
    let finishedCodeBlock = false;
    for await (const line of lines) {
        if (line.trim() === "```") {
            finishedCodeBlock = true;
        }
        if (finishedCodeBlock && isEnglishPostExplanation(line)) {
            break;
        }
        yield line;
    }
}
async function* filterLeadingNewline(lines) {
    let firstLine = true;
    for await (const line of lines) {
        if (firstLine && line.trim() === "") {
            firstLine = false;
            continue;
        }
        yield line;
    }
}
/**
 * Removes leading indentation from the first line of a CodeLlama output.
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Lines with the first line's indentation fixed if necessary.
 */
async function* fixCodeLlamaFirstLineIndentation(lines) {
    let isFirstLine = true;
    for await (const line of lines) {
        if (isFirstLine && line.startsWith("  ")) {
            yield line.slice(2);
            isFirstLine = false;
        }
        else {
            yield line;
        }
    }
}
/**
 * Filters leading and trailing blank line insertions from a stream of diff lines.
 *
 * @param {AsyncGenerator<DiffLine>} diffLines - An async generator that yields DiffLine objects.
 * @yields {DiffLine} Filtered DiffLine objects, with leading and trailing blank line insertions removed.
 *
 * @description
 * This generator function processes a stream of diff lines, removing leading and trailing
 * blank line insertions. It performs the following tasks:
 * 1. Skips the first blank line insertion if it occurs at the beginning.
 * 2. Buffers subsequent blank line insertions.
 * 3. Yields buffered blank lines when a non-blank insertion is encountered.
 * 4. Clears the buffer when an old line is encountered.
 * 5. Yields all non-blank insertions and old lines.
 */
async function* filterLeadingAndTrailingNewLineInsertion(diffLines) {
    let isFirst = true;
    let buffer = [];
    for await (const diffLine of diffLines) {
        const isBlankLineInsertion = diffLine.type === "new" && isUselessLine(diffLine.line);
        if (isFirst && isBlankLineInsertion) {
            isFirst = false;
            continue;
        }
        isFirst = false;
        if (isBlankLineInsertion) {
            buffer.push(diffLine);
        }
        else {
            if (diffLine.type === "old") {
                buffer = [];
            }
            else {
                while (buffer.length > 0) {
                    yield buffer.shift();
                }
            }
            yield diffLine;
        }
    }
}
/**
 * Filters a LineStream, stopping when a line repeats more than a specified number of times.
 *
 * @param {LineStream} lines - The input stream of lines to filter.
 * @param {() => void} fullStop - Function to call when stopping the stream.
 * @yields {string} Filtered lines until excessive repetition is detected.
 *
 * @description
 * This function yields lines from the input stream until a line is repeated
 * for a maximum of 3 consecutive times. When this limit is reached, it calls
 * the fullStop function and stops yielding. Only the first of the repeating
 * lines is yieled.
 */
async function* stopAtRepeatingLines(lines, fullStop) {
    let previousLine;
    let repeatCount = 0;
    const MAX_REPEATS = 3;
    for await (const line of lines) {
        if (line === previousLine) {
            repeatCount++;
            if (repeatCount === MAX_REPEATS) {
                fullStop();
                return;
            }
        }
        else {
            yield line;
            repeatCount = 1;
        }
        previousLine = line;
    }
}
/**
 * Pass-through, except logs the total output at the end
 * @param lines a `LineStream`
 */
async function* logLines(lines, prefix = "STREAMED LINES") {
    let linesToLog = [];
    for await (const line of lines) {
        yield line;
        linesToLog.push(line);
    }
    console.log(`${prefix}:\n${linesToLog.join("\n")}\n\n`);
}
async function* showWhateverWeHaveAtXMs(lines, ms) {
    const startTime = Date.now();
    let firstNonWhitespaceLineYielded = false;
    for await (const line of lines) {
        yield line;
        if (!firstNonWhitespaceLineYielded && line.trim() !== "") {
            firstNonWhitespaceLineYielded = true;
        }
        const isTakingTooLong = Date.now() - startTime > ms;
        if (isTakingTooLong && firstNonWhitespaceLineYielded) {
            break;
        }
    }
}
async function* noDoubleNewLine(lines) {
    let isFirstLine = true;
    for await (const line of lines) {
        if (line.trim() === "" && !isFirstLine) {
            return;
        }
        isFirstLine = false;
        yield line;
    }
}
//# sourceMappingURL=lineStream.js.map