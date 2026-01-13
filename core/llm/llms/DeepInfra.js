"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class DeepInfra extends OpenAI_js_1.default {
    constructor() {
        super(...arguments);
        this.maxStopWords = 16;
    }
    async _embed(chunks) {
        const resp = await this.fetch(`https://api.deepinfra.com/v1/inference/${this.model}`, {
            method: "POST",
            headers: {
                Authorization: `bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ inputs: chunks }),
        });
        const data = await resp.json();
        return data.embeddings;
    }
}
DeepInfra.providerName = "deepinfra";
DeepInfra.defaultOptions = {
    apiBase: "https://api.deepinfra.com/v1/openai/",
};
exports.default = DeepInfra;
//# sourceMappingURL=DeepInfra.js.map