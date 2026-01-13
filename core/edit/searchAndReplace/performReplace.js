"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFindAndReplace = executeFindAndReplace;
exports.executeMultiFindAndReplace = executeMultiFindAndReplace;
const errors_1 = require("../../util/errors");
const findSearchMatch_1 = require("./findSearchMatch");
function executeFindAndReplace(fileContent, oldString, newString, replaceAll, editIndex = 0) {
    const matches = (0, findSearchMatch_1.findSearchMatches)(fileContent, oldString);
    if (matches.length === 0) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceOldStringNotFound, `Edit at index ${editIndex}: string not found in file: "${oldString}"`);
    }
    if (replaceAll) {
        // Apply replacements in reverse order to maintain correct positions
        let result = fileContent;
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            result =
                result.substring(0, match.startIndex) +
                    newString +
                    result.substring(match.endIndex);
        }
        return result;
    }
    else {
        // For single replacement, check for multiple matches first
        if (matches.length > 1) {
            throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceMultipleOccurrences, `Edit at index ${editIndex}: String "${oldString}" appears ${matches.length} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`);
        }
        // Apply single replacement
        const match = matches[0];
        return (fileContent.substring(0, match.startIndex) +
            newString +
            fileContent.substring(match.endIndex));
    }
}
function executeMultiFindAndReplace(fileContent, edits) {
    let result = fileContent;
    // Apply edits in sequence
    for (let editIndex = 0; editIndex < edits.length; editIndex++) {
        const edit = edits[editIndex];
        result = executeFindAndReplace(result, edit.old_string, edit.new_string, edit.replace_all ?? false, editIndex);
    }
    return result;
}
//# sourceMappingURL=performReplace.js.map