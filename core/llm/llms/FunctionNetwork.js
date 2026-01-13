"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class FunctionNetwork extends OpenAI_js_1.default {
    constructor(options) {
        super(options);
    }
    _convertModelName(model) {
        return FunctionNetwork.modelConversion[model] ?? model;
    }
    supportsFim() {
        return false;
    }
    supportsCompletions() {
        return false;
    }
    supportsPrefill() {
        return false;
    }
    async _embed(chunks) {
        const resp = await this.fetch(new URL("embeddings", this.apiBase), {
            method: "POST",
            body: JSON.stringify({
                input: chunks,
                model: this.model,
            }),
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
        });
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const data = (await resp.json());
        return data.data.map((result) => result.embedding);
    }
}
FunctionNetwork.providerName = "function-network";
FunctionNetwork.defaultOptions = {
    apiBase: "https://api.function.network/v1/",
    model: "meta/llama-3.1-70b-instruct",
    maxEmbeddingBatchSize: 128,
};
FunctionNetwork.modelConversion = {
    "mistral-7b": "mistral/mistral-7b-instruct-v0.1",
    "llama3-8b": "meta/llama-3-8b-instruct",
    "llama3.1-8b": "meta/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta/llama-3.1-70b-instruct",
    "deepseek-7b": "thebloke/deepseek-coder-6.7b-instruct-awq",
};
exports.default = FunctionNetwork;
//# sourceMappingURL=FunctionNetwork.js.map