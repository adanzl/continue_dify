"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextSnippetsBlock = contextSnippetsBlock;
exports.currentFileContentBlock = currentFileContentBlock;
exports.editHistoryBlock = editHistoryBlock;
const constants_1 = require("../constants");
const utils_1 = require("./utils");
/**
 * @param contextSnippets Codestral style snippet with +++++ filename\ncontent or an empty string.
 */
function contextSnippetsBlock(contextSnippets) {
    const headerRegex = /^(\+\+\+\+\+ )(.*)/;
    const lines = contextSnippets.split("\n");
    return lines
        .reduce((acc, line) => {
        const matches = line.match(headerRegex);
        if (matches) {
            const filename = matches[2];
            acc.push(`${constants_1.INSTINCT_CONTEXT_FILE_TOKEN}: ${filename}`);
        }
        else {
            if (acc.length > 0 &&
                acc[acc.length - 1].startsWith(constants_1.INSTINCT_CONTEXT_FILE_TOKEN) // if header was added just before
            ) {
                acc.push(`${constants_1.INSTINCT_SNIPPET_TOKEN}`);
            }
            acc.push(line);
        }
        return acc;
    }, [])
        .join("\n");
}
function currentFileContentBlock(currentFileContent, windowStart, windowEnd, editableRegionStartLine, editableRegionEndLine, cursorPosition) {
    const currentFileContentLines = currentFileContent.split("\n");
    const insertedCursorLines = (0, utils_1.insertCursorToken)(currentFileContentLines, cursorPosition, constants_1.INSTINCT_USER_CURSOR_IS_HERE_TOKEN);
    const instrumentedLines = [
        ...insertedCursorLines.slice(windowStart, editableRegionStartLine),
        constants_1.INSTINCT_EDITABLE_REGION_START_TOKEN,
        ...insertedCursorLines.slice(editableRegionStartLine, editableRegionEndLine + 1),
        constants_1.INSTINCT_EDITABLE_REGION_END_TOKEN,
        ...insertedCursorLines.slice(editableRegionEndLine + 1, windowEnd + 1),
    ];
    return instrumentedLines.join("\n");
}
function editHistoryBlock(editDiffHistories) {
    if (!editDiffHistories.length) {
        return "";
    }
    const blocks = [];
    for (const editDiffHistory of editDiffHistories) {
        if (!editDiffHistory.trim()) {
            continue;
        }
        // Split on Index: lines to get the unified diff.
        const diffSections = editDiffHistory
            .split(/^Index: /m)
            .filter((section) => section.trim());
        for (const section of diffSections) {
            const lines = section.split("\n");
            // Extract filename from the first line (after "Index: " was split off).
            const filename = lines[0];
            // Find the start of the actual diff content (skip ---, +++, and === lines).
            const diffLines = lines
                .filter((line) => !line.startsWith("---") &&
                !line.startsWith("+++") &&
                !line.startsWith("===") &&
                line.trim() !== "")
                .slice(1); // remove the filename line
            // Only include lines that are actual diff content (@@, +, -, or context lines).
            const actualDiffContent = diffLines.filter((line) => line.startsWith("@@") ||
                line.startsWith("+") ||
                line.startsWith("-") ||
                line.startsWith(" "));
            if (actualDiffContent.length === 0)
                continue;
            const diffBlock = [
                `User edited file "${filename}"`,
                "",
                "```diff",
                actualDiffContent.join("\n"),
                "```",
            ].join("\n");
            blocks.push(diffBlock);
        }
    }
    return blocks.join("\n");
}
//# sourceMappingURL=instinct.js.map