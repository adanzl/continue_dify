"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Novita extends OpenAI_js_1.default {
    _convertModelName(model) {
        return Novita.MODEL_IDS[model] || this.model;
    }
    async *_streamComplete(prompt, signal, options) {
        for await (const chunk of this._legacystreamComplete(prompt, signal, options)) {
            yield chunk;
        }
    }
}
Novita.providerName = "novita";
Novita.defaultOptions = {
    apiBase: "https://api.novita.ai/v3/openai/",
};
Novita.MODEL_IDS = {
    "deepseek-r1": "deepseek/deepseek-r1",
    deepseek_v3: "deepseek/deepseek_v3",
    "llama3-8b": "meta-llama/llama-3-8b-instruct",
    "llama3-70b": "meta-llama/llama-3-70b-instruct",
    "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta-llama/llama-3.1-70b-instruct",
    "llama3.1-405b": "meta-llama/llama-3.1-405b-instruct",
    "llama3.2-1b": "meta-llama/llama-3.2-1b-instruct",
    "llama3.2-3b": "meta-llama/llama-3.2-3b-instruct",
    "llama3.2-11b": "meta-llama/llama-3.2-11b-vision-instruct",
    "llama3.3-70b": "meta-llama/llama-3.3-70b-instruct",
    "mistral-nemo": "mistralai/mistral-nemo",
    "mistral-7b": "mistralai/mistral-7b-instruct",
};
exports.default = Novita;
//# sourceMappingURL=Novita.js.map