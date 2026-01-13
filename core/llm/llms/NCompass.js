"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class NCompass extends OpenAI_js_1.default {
    _convertModelName(model) {
        return NCompass.modelConversion[model] ?? model;
    }
    _convertArgs(options, messages) {
        const finalOptions = super._convertArgs(options, messages);
        finalOptions.model = this._convertModelName(options.model);
        return finalOptions;
    }
    _getHeaders() {
        const headers = super._getHeaders();
        headers["Accept"] = "text/event-stream";
        return headers;
    }
    async _embed(chunks) {
        const resp = await this.fetch(NCompass.embeddingsApiEndpoint, {
            method: "POST",
            body: JSON.stringify({
                input: chunks,
                model: this.model,
                ...this.extraBodyProperties(),
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
NCompass.providerName = "ncompass";
NCompass.defaultOptions = {
    apiBase: "https://api.ncompass.tech/v1/",
};
NCompass.embeddingsApiEndpoint = "https://api.gcp.ncompass.tech/v1/embeddings";
NCompass.modelConversion = {
    "qwen2.5-coder-7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "qwen2.5-coder:7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "qwen2.5-coder:32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
};
exports.default = NCompass;
//# sourceMappingURL=NCompass.js.map