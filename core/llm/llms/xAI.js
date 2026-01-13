"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class xAI extends OpenAI_js_1.default {
}
xAI.providerName = "xAI";
xAI.defaultOptions = {
    apiBase: "https://api.x.ai/v1/",
};
exports.default = xAI;
//# sourceMappingURL=xAI.js.map