"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileImpl = void 0;
const pathResolver_1 = require("../../util/pathResolver");
const uri_1 = require("../../util/uri");
const ignore_1 = require("../../indexing/ignore");
const parseArgs_1 = require("../parseArgs");
const readFileLimit_1 = require("./readFileLimit");
const errors_1 = require("../../util/errors");
const readFileImpl = async (args, extras) => {
    const filepath = (0, parseArgs_1.getStringArg)(args, "filepath");
    // Resolve the path first to get the actual path for security check
    const resolvedPath = await (0, pathResolver_1.resolveInputPath)(extras.ide, filepath);
    if (!resolvedPath) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileNotFound, `File "${filepath}" does not exist or is not accessible. You might want to check the path and try again.`);
    }
    // Security check on the resolved display path
    (0, ignore_1.throwIfFileIsSecurityConcern)(resolvedPath.displayPath);
    const content = await extras.ide.readFile(resolvedPath.uri);
    await (0, readFileLimit_1.throwIfFileExceedsHalfOfContext)(resolvedPath.displayPath, content, extras.config.selectedModelByRole.chat);
    return [
        {
            name: (0, uri_1.getUriPathBasename)(resolvedPath.uri),
            description: resolvedPath.displayPath,
            content,
            uri: {
                type: "file",
                value: resolvedPath.uri,
            },
        },
    ];
};
exports.readFileImpl = readFileImpl;
//# sourceMappingURL=readFile.js.map