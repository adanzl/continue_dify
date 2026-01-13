"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileRangeImpl = exports.MAX_CHAR_POSITION = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const uri_1 = require("../../util/uri");
const ignore_1 = require("../../indexing/ignore");
const parseArgs_1 = require("../parseArgs");
const readFileLimit_1 = require("./readFileLimit");
const errors_1 = require("../../util/errors");
// Use Int.MAX_VALUE from Java/Kotlin (2^31 - 1) instead of JavaScript's Number.MAX_SAFE_INTEGER
// to ensure compatibility with IntelliJ's Kotlin Position type which uses Int for character field
exports.MAX_CHAR_POSITION = 2147483647;
const readFileRangeImpl = async (args, extras) => {
    const filepath = (0, parseArgs_1.getStringArg)(args, "filepath");
    const startLine = (0, parseArgs_1.getNumberArg)(args, "startLine");
    const endLine = (0, parseArgs_1.getNumberArg)(args, "endLine");
    // Validate that line numbers are positive integers
    if (startLine < 1) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.InvalidLineNumber, "startLine must be 1 or greater. Negative line numbers are not supported - use the terminal tool with 'tail' command for reading from file end.");
    }
    if (endLine < 1) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.InvalidLineNumber, "endLine must be 1 or greater. Negative line numbers are not supported - use the terminal tool with 'tail' command for reading from file end.");
    }
    if (endLine < startLine) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.InvalidLineNumber, `endLine (${endLine}) must be greater than or equal to startLine (${startLine})`);
    }
    // Resolve the path first to get the actual path for security check
    const resolvedPath = await (0, pathResolver_1.resolveInputPath)(extras.ide, filepath);
    if (!resolvedPath) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileNotFound, `File "${filepath}" does not exist or is not accessible. You might want to check the path and try again.`);
    }
    // Security check on the resolved display path
    (0, ignore_1.throwIfFileIsSecurityConcern)(resolvedPath.displayPath);
    // Use the IDE's readRangeInFile method with 0-based range (IDE expects 0-based internally)
    const content = await extras.ide.readRangeInFile(resolvedPath.uri, {
        start: {
            line: startLine - 1, // Convert from 1-based to 0-based
            character: 0,
        },
        end: {
            line: endLine - 1, // Convert from 1-based to 0-based
            character: exports.MAX_CHAR_POSITION, // Read to end of line
        },
    });
    await (0, readFileLimit_1.throwIfFileExceedsHalfOfContext)(resolvedPath.displayPath, content, extras.config.selectedModelByRole.chat);
    const rangeDescription = `${resolvedPath.displayPath} (lines ${startLine}-${endLine})`;
    return [
        {
            name: (0, uri_1.getUriPathBasename)(resolvedPath.uri),
            description: rangeDescription,
            content,
            uri: {
                type: "file",
                value: resolvedPath.uri,
            },
        },
    ];
};
exports.readFileRangeImpl = readFileRangeImpl;
//# sourceMappingURL=readFileRange.js.map