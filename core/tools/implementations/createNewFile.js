"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewFileImpl = void 0;
const ideUtils_1 = require("../../util/ideUtils");
const uri_1 = require("../../util/uri");
const parseArgs_1 = require("../parseArgs");
const errors_1 = require("../../util/errors");
const createNewFileImpl = async (args, extras) => {
    const filepath = (0, parseArgs_1.getStringArg)(args, "filepath");
    const contents = (0, parseArgs_1.getStringArg)(args, "contents", true);
    const resolvedFileUri = await (0, ideUtils_1.inferResolvedUriFromRelativePath)(filepath, extras.ide);
    if (resolvedFileUri) {
        const exists = await extras.ide.fileExists(resolvedFileUri);
        if (exists) {
            throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileAlreadyExists, `File ${filepath} already exists. Use the edit tool to edit this file`);
        }
        await extras.ide.writeFile(resolvedFileUri, contents);
        await extras.ide.openFile(resolvedFileUri);
        await extras.ide.saveFile(resolvedFileUri);
        if (extras.codeBaseIndexer) {
            void extras.codeBaseIndexer?.refreshCodebaseIndexFiles([resolvedFileUri]);
        }
        return [
            {
                name: (0, uri_1.getUriPathBasename)(resolvedFileUri),
                description: (0, uri_1.getCleanUriPath)(resolvedFileUri),
                content: "File created successfuly",
                uri: {
                    type: "file",
                    value: resolvedFileUri,
                },
            },
        ];
    }
    else {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.PathResolutionFailed, "Failed to resolve path");
    }
};
exports.createNewFileImpl = createNewFileImpl;
//# sourceMappingURL=createNewFile.js.map