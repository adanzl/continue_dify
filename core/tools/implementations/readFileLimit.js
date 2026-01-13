"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwIfFileExceedsHalfOfContext = throwIfFileExceedsHalfOfContext;
const countTokens_1 = require("../../llm/countTokens");
const errors_1 = require("../../util/errors");
async function throwIfFileExceedsHalfOfContext(filepath, content, model) {
    if (model) {
        const tokens = await (0, countTokens_1.countTokensAsync)(content, model.title);
        const tokenLimit = model.contextLength / 2;
        if (tokens > tokenLimit) {
            throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileTooLarge, `File ${filepath} is too large (${tokens} tokens vs ${tokenLimit} token limit). Try another approach`);
        }
    }
}
//# sourceMappingURL=readFileLimit.js.map