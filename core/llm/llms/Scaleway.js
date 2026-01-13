"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_1 = __importDefault(require("./OpenAI"));
class Scaleway extends OpenAI_1.default {
    _convertModelName(model) {
        return Scaleway.MODEL_IDS[model] || this.model;
    }
    _convertArgs(options, messages) {
        // Convert model name in the options before passing to parent
        const modifiedOptions = {
            ...options,
            model: this._convertModelName(options.model),
        };
        return super._convertArgs(modifiedOptions, messages);
    }
}
Scaleway.providerName = "scaleway";
Scaleway.defaultOptions = {
    apiBase: "https://api.scaleway.ai/v1/",
    model: "qwen3-coder-30b-a3b-instruct",
    useLegacyCompletionsEndpoint: false,
};
Scaleway.MODEL_IDS = {
    "llama3.1-8b": "llama-3.1-8b-instruct",
    "llama3.3-70b": "llama-3.3-70b-instruct",
    "pixtral-12b": "pixtral-12b-2409",
    "mistral-small3.1": "mistral-small-3.1-24b-instruct-2503",
    "mistral-small3.2": "mistral-small-3.2-24b-instruct-2506",
    "devstral-small": "devstral-small-2505",
    "deepseek-r1-distill-llama-70b": "deepseek-r1-distill-llama-70b",
    "qwen2.5-coder-32b": "qwen2.5-coder-32b-instruct",
    "qwen3-coder-30b-a3b": "qwen3-coder-30b-a3b-instruct",
    "qwen3-235b-a22b": "qwen3-235b-a22b-instruct-2507",
    "gemma-3-27b": "gemma-3-27b-it",
    "gpt-oss-120b": "gpt-oss-120b",
};
exports.default = Scaleway;
//# sourceMappingURL=Scaleway.js.map