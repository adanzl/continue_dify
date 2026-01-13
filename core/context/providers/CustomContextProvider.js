"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CustomContextProviderClass {
    constructor(custom) {
        this.custom = custom;
    }
    get description() {
        return {
            title: this.custom.title,
            displayTitle: this.custom.displayTitle ?? this.custom.title,
            description: this.custom.description ?? "",
            type: this.custom.type ?? "normal",
            renderInlineAs: this.custom.renderInlineAs,
        };
    }
    async getContextItems(query, extras) {
        return await this.custom.getContextItems(query, extras);
    }
    async loadSubmenuItems(args) {
        return this.custom.loadSubmenuItems?.(args) ?? [];
    }
    get deprecationMessage() {
        return null;
    }
}
exports.default = CustomContextProviderClass;
//# sourceMappingURL=CustomContextProvider.js.map