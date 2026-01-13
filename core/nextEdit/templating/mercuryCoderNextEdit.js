"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recentlyViewedCodeSnippetsBlock = recentlyViewedCodeSnippetsBlock;
exports.currentFileContentBlock = currentFileContentBlock;
exports.editHistoryBlock = editHistoryBlock;
const constants_1 = require("../constants");
const utils_1 = require("./utils");
function recentlyViewedCodeSnippetsBlock(recentlyViewedCodeSnippets) {
    return recentlyViewedCodeSnippets.reduce((acc, snippet, i) => {
        const block = [
            constants_1.MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN,
            `code_snippet_file_path: ${snippet.filepath}`,
            snippet.content,
            constants_1.MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE,
        ].join("\n");
        return (acc + block + (i === recentlyViewedCodeSnippets.length - 1 ? "" : "\n"));
    }, "");
}
function currentFileContentBlock(currentFileContent, editableRegionStartLine, editableRegionEndLine, cursorPosition) {
    const currentFileContentLines = currentFileContent.split("\n");
    const insertedCursorLines = (0, utils_1.insertCursorToken)(currentFileContentLines, cursorPosition, constants_1.MERCURY_CURSOR);
    const instrumentedLines = [
        ...insertedCursorLines.slice(0, editableRegionStartLine),
        constants_1.MERCURY_CODE_TO_EDIT_OPEN,
        ...insertedCursorLines.slice(editableRegionStartLine, editableRegionEndLine + 1),
        constants_1.MERCURY_CODE_TO_EDIT_CLOSE,
        ...insertedCursorLines.slice(editableRegionEndLine + 1),
    ];
    return instrumentedLines.join("\n");
}
function editHistoryBlock(editDiffHistory) {
    // diffHistory is made from createDiff.
    // This uses createPatch from npm diff library, which includes an index line and a separator.
    // We get rid of these first two lines.
    return editDiffHistory
        .map((diff) => diff.split("\n").slice(2).join("\n"))
        .join("\n");
    // return editDiffHistory.split("\n").slice(2).join("\n");
}
function mercuryNextEditTemplateBuilder(recentlyViewedCodeSnippets, currentFileContent, codeToEdit, codeToEditRange, cursorPosition, editDiffHistory) {
    return "";
}
//# sourceMappingURL=mercuryCoderNextEdit.js.map