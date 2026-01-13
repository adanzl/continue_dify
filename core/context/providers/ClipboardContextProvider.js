"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const clipboardCache_1 = require("../../util/clipboardCache");
const MAX_CLIPBOARD_ITEMS = 10;
class ClipboardContextProvider extends __1.BaseContextProvider {
    get deprecationMessage() {
        return "The clipboard context provider is deprecated as it is not used. It will be removed in a future version.";
    }
    async getContextItems(query, extras) {
        // Assume the query is a cache id
        const id = query.trim();
        const content = clipboardCache_1.clipboardCache.get(id);
        if (content) {
            clipboardCache_1.clipboardCache.select(id);
            return [
                {
                    name: "Clipboard item",
                    description: content.slice(0, 20),
                    content,
                },
            ];
        }
        return [];
    }
    async loadSubmenuItems(args) {
        const recentClipboardItems = clipboardCache_1.clipboardCache.getNItems(MAX_CLIPBOARD_ITEMS);
        console.log(recentClipboardItems);
        return recentClipboardItems.map((item, index) => {
            return {
                id: item.id,
                title: item.content.slice(0, 20),
                description: `#${index + 1}`,
            };
        });
    }
}
ClipboardContextProvider.description = {
    title: "clipboard",
    displayTitle: "Clipboard",
    description: "Recent copies",
    type: "submenu",
};
exports.default = ClipboardContextProvider;
//# sourceMappingURL=ClipboardContextProvider.js.map