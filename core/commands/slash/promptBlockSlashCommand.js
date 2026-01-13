"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertPromptBlockToSlashCommand = convertPromptBlockToSlashCommand;
function convertPromptBlockToSlashCommand(prompt) {
    return {
        name: prompt.name,
        description: prompt.description ?? "",
        prompt: prompt.prompt,
        source: "yaml-prompt-block",
        sourceFile: prompt.sourceFile,
    };
}
//# sourceMappingURL=promptBlockSlashCommand.js.map