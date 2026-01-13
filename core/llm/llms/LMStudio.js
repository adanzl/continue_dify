"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class LMStudio extends OpenAI_js_1.default {
}
LMStudio.providerName = "lmstudio";
LMStudio.defaultOptions = {
    apiBase: "http://localhost:1234/v1/",
};
exports.default = LMStudio;
//# sourceMappingURL=LMStudio.js.map