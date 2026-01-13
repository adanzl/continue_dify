"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextEditProviderFactory = void 0;
const constants_js_1 = require("../llm/constants.js");
const InstinctNextEditProvider_js_1 = require("./providers/InstinctNextEditProvider.js");
const MercuryCoderNextEditProvider_js_1 = require("./providers/MercuryCoderNextEditProvider.js");
class NextEditProviderFactory {
    static createProvider(modelName) {
        if (modelName.includes(constants_js_1.NEXT_EDIT_MODELS.MERCURY_CODER)) {
            return new MercuryCoderNextEditProvider_js_1.MercuryCoderProvider();
        }
        else if (modelName.includes(constants_js_1.NEXT_EDIT_MODELS.INSTINCT)) {
            return new InstinctNextEditProvider_js_1.InstinctProvider();
        }
        else {
            throw new Error(`Unsupported model: ${modelName}`);
        }
    }
}
exports.NextEditProviderFactory = NextEditProviderFactory;
//# sourceMappingURL=NextEditProviderFactory.js.map