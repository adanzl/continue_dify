"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSearchAndReplaceFilepath = validateSearchAndReplaceFilepath;
const errors_1 = require("../../util/errors");
const ideUtils_1 = require("../../util/ideUtils");
async function validateSearchAndReplaceFilepath(filepath, ide) {
    if (!filepath || typeof filepath !== "string") {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FindAndReplaceMissingFilepath, "filepath (string) is required");
    }
    const resolvedFilepath = await (0, ideUtils_1.resolveRelativePathInDir)(filepath, ide);
    if (!resolvedFilepath) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileNotFound, `File ${filepath} does not exist`);
    }
    return resolvedFilepath;
}
//# sourceMappingURL=validateArgs.js.map