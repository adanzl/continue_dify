"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const edit_js_1 = require("../templates/edit.js");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class LlamaStack extends OpenAI_js_1.default {
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
}
LlamaStack.providerName = "llamastack";
LlamaStack.defaultOptions = {
    apiBase: "http://localhost:8321/v1/openai/v1/",
    model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    promptTemplates: {
        edit: edit_js_1.osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
};
exports.default = LlamaStack;
//# sourceMappingURL=LlamaStack.js.map