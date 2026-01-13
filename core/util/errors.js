"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinueErrorReason = exports.ContinueError = void 0;
exports.getRootCause = getRootCause;
/**
 * Recursively retrieves the root cause of an error by traversing through its `cause` property.
 *
 * @param err - The error object to analyze. It can be of any type.
 * @returns The root cause of the error, or the original error if no further cause is found.
 */
function getRootCause(err) {
    if (err.cause) {
        return getRootCause(err.cause);
    }
    return err;
}
class ContinueError extends Error {
    constructor(reason, message) {
        super(message);
        this.reason = reason;
        this.name = "ContinueError";
    }
}
exports.ContinueError = ContinueError;
var ContinueErrorReason;
(function (ContinueErrorReason) {
    // Find and Replace validation errors
    ContinueErrorReason["FindAndReplaceIdenticalOldAndNewStrings"] = "find_and_replace_identical_old_and_new_strings";
    ContinueErrorReason["FindAndReplaceMissingOldString"] = "find_and_replace_missing_old_string";
    ContinueErrorReason["FindAndReplaceNonFirstEmptyOldString"] = "find_and_replace_non_first_empty_old_string";
    ContinueErrorReason["FindAndReplaceMissingNewString"] = "find_and_replace_missing_new_string";
    ContinueErrorReason["FindAndReplaceInvalidReplaceAll"] = "find_and_replace_invalid_replace_all";
    ContinueErrorReason["FindAndReplaceOldStringNotFound"] = "find_and_replace_old_string_not_found";
    ContinueErrorReason["FindAndReplaceMultipleOccurrences"] = "find_and_replace_multiple_occurrences";
    ContinueErrorReason["FindAndReplaceMissingFilepath"] = "find_and_replace_missing_filepath";
    // Multi-edit
    ContinueErrorReason["MultiEditEditsArrayRequired"] = "multi_edit_edits_array_required";
    ContinueErrorReason["MultiEditEditsArrayEmpty"] = "multi_edit_edits_array_empty";
    ContinueErrorReason["MultiEditSubsequentEditsOnCreation"] = "multi_edit_subsequent_edits_on_creation";
    ContinueErrorReason["MultiEditEmptyOldStringNotFirst"] = "multi_edit_empty_old_string_not_first";
    // General Edit
    ContinueErrorReason["EditToolFileNotRead"] = "edit_tool_file_not_yet_read";
    // General File
    ContinueErrorReason["FileAlreadyExists"] = "file_already_exists";
    ContinueErrorReason["FileNotFound"] = "file_not_found";
    ContinueErrorReason["FileWriteError"] = "file_write_error";
    ContinueErrorReason["FileIsSecurityConcern"] = "file_is_security_concern";
    ContinueErrorReason["ParentDirectoryNotFound"] = "parent_directory_not_found";
    ContinueErrorReason["FileTooLarge"] = "file_too_large";
    ContinueErrorReason["PathResolutionFailed"] = "path_resolution_failed";
    ContinueErrorReason["InvalidLineNumber"] = "invalid_line_number";
    ContinueErrorReason["DirectoryNotFound"] = "directory_not_found";
    // Terminal/Command execution
    ContinueErrorReason["CommandExecutionFailed"] = "command_execution_failed";
    ContinueErrorReason["CommandNotAvailableInRemote"] = "command_not_available_in_remote";
    // Search
    ContinueErrorReason["SearchExecutionFailed"] = "search_execution_failed";
    // Rules
    ContinueErrorReason["RuleNotFound"] = "rule_not_found";
    // Other
    ContinueErrorReason["Unspecified"] = "unspecified";
    ContinueErrorReason["Unknown"] = "unknown";
})(ContinueErrorReason || (exports.ContinueErrorReason = ContinueErrorReason = {}));
//# sourceMappingURL=errors.js.map