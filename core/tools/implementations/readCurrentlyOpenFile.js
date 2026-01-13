"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCurrentlyOpenFileImpl = void 0;
const uri_1 = require("../../util/uri");
const ignore_1 = require("../../indexing/ignore");
const readFileLimit_1 = require("./readFileLimit");
const readCurrentlyOpenFileImpl = async (_, extras) => {
    const result = await extras.ide.getCurrentFile();
    if (result) {
        (0, ignore_1.throwIfFileIsSecurityConcern)(result.path);
        await (0, readFileLimit_1.throwIfFileExceedsHalfOfContext)(result.path, result.contents, extras.config.selectedModelByRole.chat);
        const { relativePathOrBasename, last2Parts, baseName } = (0, uri_1.getUriDescription)(result.path, await extras.ide.getWorkspaceDirs());
        return [
            {
                name: `Current file: ${baseName}`,
                description: last2Parts,
                content: `\`\`\`${relativePathOrBasename}\n${result.contents}\n\`\`\``,
                uri: {
                    type: "file",
                    value: result.path,
                },
            },
        ];
    }
    else {
        return [
            {
                name: `No Current File`,
                description: "",
                content: "There are no files currently open.",
            },
        ];
    }
};
exports.readCurrentlyOpenFileImpl = readCurrentlyOpenFileImpl;
//# sourceMappingURL=readCurrentlyOpenFile.js.map