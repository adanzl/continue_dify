"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBase64FromDataUrl = exports.parseDataUrl = void 0;
exports.canParseUrl = canParseUrl;
const openai_adapters_1 = require("@continuedev/openai-adapters");
function canParseUrl(url) {
    if (URL?.canParse) {
        return URL.canParse(url);
    }
    try {
        new URL(url);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.parseDataUrl = openai_adapters_1.parseDataUrl;
exports.extractBase64FromDataUrl = openai_adapters_1.extractBase64FromDataUrl;
//# sourceMappingURL=url.js.map