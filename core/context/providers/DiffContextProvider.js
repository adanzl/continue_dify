"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class DiffContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const includeUnstaged = this.options?.includeUnstaged ?? true;
        const diffs = await extras.ide.getDiff(includeUnstaged); // TODO use diff cache (currently cache always includes unstaged)
        return [
            {
                description: "The current git diff",
                content: diffs.length === 0
                    ? "Git shows no current changes."
                    : `\`\`\`git diff\n${diffs.join("\n")}\n\`\`\``,
                name: "Git Diff",
            },
        ];
    }
}
DiffContextProvider.description = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    type: "normal",
};
exports.default = DiffContextProvider;
//# sourceMappingURL=DiffContextProvider.js.map