"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const uri_1 = require("../../util/uri");
class CurrentFileContextProvider extends __1.BaseContextProvider {
    async getContextItems(query, extras) {
        const currentFile = await extras.ide.getCurrentFile();
        if (!currentFile) {
            return [];
        }
        const { relativePathOrBasename, last2Parts, baseName } = (0, uri_1.getUriDescription)(currentFile.path, await extras.ide.getWorkspaceDirs());
        let prefix = "This is the currently open file:";
        let name = baseName;
        // This allows frontend to retrieve when using alt + enter or default context with slightly different copy
        if (query === "non-mention-usage") {
            prefix =
                "The following file is currently open. Don't reference it if it's not relevant to the user's message:";
            name = "Active file: " + baseName;
        }
        return [
            {
                description: last2Parts,
                content: `${prefix}\n\n\`\`\`${relativePathOrBasename}\n${currentFile.contents}\n\`\`\``,
                name,
                uri: {
                    type: "file",
                    value: currentFile.path,
                },
            },
        ];
    }
}
CurrentFileContextProvider.description = {
    title: "currentFile",
    displayTitle: "Current File",
    description: "Reference the currently open file",
    type: "normal",
    renderInlineAs: "",
};
exports.default = CurrentFileContextProvider;
//# sourceMappingURL=CurrentFileContextProvider.js.map