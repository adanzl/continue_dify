"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Nvidia extends OpenAI_js_1.default {
    constructor() {
        super(...arguments);
        // NVIDIA NIMs currently limits the number of stops for Starcoder 2 to 4
        // https://docs.api.nvidia.com/nim/reference/bigcode-starcoder2-7b-infer
        this.maxStopWords = 4;
    }
    async _embed(chunks) {
        const resp = await this.fetch(new URL("embeddings", this.apiBase), {
            method: "POST",
            body: JSON.stringify({
                input: chunks,
                model: this.model,
                input_type: "passage",
                truncate: "END",
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
Nvidia.providerName = "nvidia";
Nvidia.defaultOptions = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    useLegacyCompletionsEndpoint: false,
    maxEmbeddingBatchSize: 96,
};
exports.default = Nvidia;
//# sourceMappingURL=Nvidia.js.map