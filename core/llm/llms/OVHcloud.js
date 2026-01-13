"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OVHcloud = void 0;
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class OVHcloud extends OpenAI_js_1.default {
    _convertModelName(model) {
        return OVHcloud.MODEL_IDS[model] || this.model;
    }
    _convertArgs(options, messages) {
        const modifiedOptions = {
            ...options,
            model: this._convertModelName(options.model),
        };
        return super._convertArgs(modifiedOptions, messages);
    }
}
exports.OVHcloud = OVHcloud;
OVHcloud.providerName = "ovhcloud";
OVHcloud.defaultOptions = {
    apiBase: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/",
    model: "Qwen2.5-Coder-32B-Instruct",
    useLegacyCompletionsEndpoint: false,
};
OVHcloud.MODEL_IDS = {
    "llama3.1-8b": "Llama-3.1-8B-Instruct",
    "llama3.1-70b": "Meta-Llama-3_1-70B-Instruct",
    "llama3.3-70b": "Meta-Llama-3_3-70B-Instruct",
    "qwen2.5-coder-32b": "Qwen2.5-Coder-32B-Instruct",
    "codestral-mamba-latest": "mamba-codestral-7B-v0.1",
    "mistral-7b": "Mistral-7B-Instruct-v0.3",
    "mistral-8x7b": "Mixtral-8x7B-Instruct-v0.1",
    "mistral-nemo": "Mistral-Nemo-Instruct-2407",
    "DeepSeek-R1-Distill-Llama-70B": "DeepSeek-R1-Distill-Llama-70B",
};
exports.default = OVHcloud;
//# sourceMappingURL=OVHcloud.js.map