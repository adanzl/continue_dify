"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOUND_MULTIPLE_FIND_STRINGS_ERROR = void 0;
exports.validateSingleEdit = validateSingleEdit;
exports.trimEmptyLines = trimEmptyLines;
const errors_1 = require("../../util/errors");
exports.FOUND_MULTIPLE_FIND_STRINGS_ERROR = "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.";
/**
 * Validates a single edit operation
 */
function validateSingleEdit(oldString, newString, replaceAll, index) {
    const context = index !== undefined ? `edit at index ${index}: ` : "";
    if (oldString === undefined || typeof oldString !== "string") {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceMissingOldString, `${context}string old_string is required`);
    }
    if (newString === undefined || typeof newString !== "string") {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceMissingNewString, `${context}string new_string is required`);
    }
    if (oldString === newString) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings, `${context}old_string and new_string must be different`);
    }
    if (replaceAll !== undefined && typeof replaceAll !== "boolean") {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceInvalidReplaceAll, `${context}replace_all must be a valid boolean`);
    }
    return { oldString, newString, replaceAll };
}
function trimEmptyLines({ lines, fromEnd, }) {
    lines = fromEnd ? lines.slice().reverse() : lines.slice();
    const newLines = [];
    let shouldContinueRemoving = true;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (shouldContinueRemoving && line.trim() === "")
            continue;
        shouldContinueRemoving = false;
        newLines.push(line);
    }
    return fromEnd ? newLines.reverse() : newLines;
}
//# sourceMappingURL=findAndReplaceUtils.js.map