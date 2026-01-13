"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slashCommandFromPromptFile = slashCommandFromPromptFile;
const parsePromptFile_1 = require("../../promptFiles/parsePromptFile");
function slashCommandFromPromptFile(path, content) {
    const { name, description, systemMessage, prompt, version } = (0, parsePromptFile_1.parsePromptFile)(path, content);
    return {
        name,
        description,
        prompt,
        source: version === 1 ? "prompt-file-v1" : "prompt-file-v2",
        sourceFile: path,
        overrideSystemMessage: systemMessage,
    };
}
//# sourceMappingURL=promptFileSlashCommand.js.map