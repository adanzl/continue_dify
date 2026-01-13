"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const edit_js_1 = require("../templates/edit.js");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class SiliconFlow extends OpenAI_js_1.default {
    constructor() {
        super(...arguments);
        this.maxStopWords = 16;
    }
    supportsFim() {
        return true;
    }
    async *_streamFim(prefix, suffix, signal, options) {
        const endpoint = new URL("completions", this.apiBase);
        const resp = await this.fetch(endpoint, {
            method: "POST",
            body: JSON.stringify({
                model: options.model,
                prompt: prefix,
                suffix,
                max_tokens: options.maxTokens,
                temperature: options.temperature,
                top_p: options.topP,
                frequency_penalty: options.frequencyPenalty,
                presence_penalty: options.presencePenalty,
                stop: options.stop,
                stream: true,
            }),
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            signal,
        });
        for await (const chunk of (0, fetch_1.streamSse)(resp)) {
            yield chunk.choices[0].text;
        }
    }
    async rerank(query, chunks) {
        if (!query || query.trim() === "") {
            console.warn("[SiliconFlow] rerank: query is empty");
            return [];
        }
        if (!chunks || chunks.length === 0) {
            console.warn("[SiliconFlow] rerank: chunks is empty");
            return [];
        }
        const endpoint = new URL("rerank", this.apiBase);
        const resp = await this.fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                query,
                documents: chunks.map((chunk) => chunk.content),
            }),
        });
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const data = (await resp.json());
        const results = data.results.sort((a, b) => a.index - b.index);
        return results.map((result) => result.relevance_score);
    }
}
SiliconFlow.providerName = "siliconflow";
SiliconFlow.defaultOptions = {
    apiBase: "https://api.siliconflow.cn/v1/",
    model: "Qwen/Qwen2.5-Coder-32B-Instruct",
    promptTemplates: {
        edit: edit_js_1.osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
};
exports.default = SiliconFlow;
//# sourceMappingURL=SiliconFlow.js.map