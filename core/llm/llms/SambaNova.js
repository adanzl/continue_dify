"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class SambaNova extends OpenAI_js_1.default {
    _convertModelName(model) {
        return SambaNova.MODEL_IDS[model] || this.model;
    }
}
SambaNova.providerName = "sambanova";
SambaNova.defaultOptions = {
    apiBase: "https://api.sambanova.ai/v1/",
};
SambaNova.MODEL_IDS = {
    "llama4-maverick": "Llama-4-Maverick-17B-128E-Instruct",
    "llama3.3-70b": "Meta-Llama-3.3-70B-Instruct",
    "llama3.3-swalllow-70b": "Llama-3.3-Swallow-70B-Instruct-v0.4",
    "llama3.1-8b": "Meta-Llama-3.1-8B-Instruct",
    "deepseek-r1-distill-llama-70b": "DeepSeek-R1-Distill-Llama-70B",
    "deepseek-r1": "DeepSeek-R1",
    "deepseek-v3": "DeepSeek-V3-0324",
    "deepseek-v3.1": "DeepSeek-V3-0324",
    "gpt-oss-120b": "gpt-oss-120b",
    "qwen3-32b": "Qwen3-32B",
};
exports.default = SambaNova;
//# sourceMappingURL=SambaNova.js.map