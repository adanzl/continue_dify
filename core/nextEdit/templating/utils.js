"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertCursorToken = insertCursorToken;
exports.insertEditableRegionTokensWithStaticRange = insertEditableRegionTokensWithStaticRange;
const constants_1 = require("../constants");
function insertCursorToken(lines, cursorPos, cursorToken) {
    if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
        return lines;
    }
    // Ensure character position is within bounds or at the end of the line.
    const lineLength = lines[cursorPos.line].length;
    const charPos = Math.min(Math.max(0, cursorPos.character), lineLength);
    lines[cursorPos.line] =
        lines[cursorPos.line].slice(0, charPos) +
            cursorToken +
            lines[cursorPos.line].slice(charPos);
    return lines;
}
function insertEditableRegionTokensWithStaticRange(lines, cursorPos, editableRegionStart, editableRegionEnd) {
    if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
        return lines;
    }
    // Ensure editable regions are within bounds.
    if (editableRegionStart === undefined) {
        editableRegionStart = Math.max(cursorPos.line - constants_1.NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN, 0);
    }
    if (editableRegionEnd === undefined) {
        editableRegionEnd = Math.min(cursorPos.line + constants_1.NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN, lines.length - 1);
    }
    const instrumentedLines = [
        ...lines.slice(0, editableRegionStart),
        constants_1.INSTINCT_EDITABLE_REGION_START_TOKEN,
        ...lines.slice(editableRegionStart, editableRegionEnd + 1),
        constants_1.INSTINCT_EDITABLE_REGION_END_TOKEN,
        ...lines.slice(editableRegionEnd + 1),
    ];
    return instrumentedLines;
}
//# sourceMappingURL=utils.js.map