"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class TerminalContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const content = await extras.ide.getTerminalContents();
        return [
            {
                description: "The contents of the terminal",
                content: `Current terminal contents:\n\n${content || "The terminal is empty."}`,
                name: "Terminal",
            },
        ];
    }
}
TerminalContextProvider.description = {
    title: "terminal",
    displayTitle: "Terminal",
    description: "Reference the last terminal command",
    type: "normal",
};
exports.default = TerminalContextProvider;
//# sourceMappingURL=TerminalContextProvider.js.map