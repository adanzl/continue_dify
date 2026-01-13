"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseContextProvider = void 0;
class BaseContextProvider {
    constructor(options) {
        this.options = options;
    }
    get description() {
        return this.constructor.description;
    }
    async loadSubmenuItems(args) {
        return [];
    }
    get deprecationMessage() {
        return null;
    }
}
exports.BaseContextProvider = BaseContextProvider;
//# sourceMappingURL=index.js.map