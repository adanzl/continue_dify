"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class TextGenWebUI extends OpenAI_js_1.default {
}
TextGenWebUI.providerName = "text-gen-webui";
TextGenWebUI.defaultOptions = {
    apiBase: "http://localhost:5000/v1/",
};
exports.default = TextGenWebUI;
//# sourceMappingURL=TextGenWebUI.js.map