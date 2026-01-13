"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCustomCommandToSlashCommand = convertCustomCommandToSlashCommand;
function convertCustomCommandToSlashCommand(customCommand) {
    const commandName = customCommand.name.startsWith("/")
        ? customCommand.name.substring(1)
        : customCommand.name;
    return {
        name: commandName,
        description: customCommand.description ?? "",
        prompt: customCommand.prompt,
        source: "json-custom-command",
        sourceFile: customCommand.sourceFile,
    };
}
//# sourceMappingURL=customSlashCommand.js.map