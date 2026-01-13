"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const index_js_1 = require("../index.js");
class HuggingFaceInferenceAPI extends index_js_1.BaseLLM {
    _convertArgs(options) {
        return {
            max_new_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature,
            top_k: options.topK,
            top_p: options.topP,
        };
    }
    async *_streamComplete(prompt, signal, options) {
        if (!this.apiBase) {
            throw new Error("No API base URL provided. Please add the `apiBase` field in your config.json.");
        }
        const response = await this.fetch(this.apiBase, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                inputs: prompt,
                stream: true,
                parameters: this._convertArgs(options),
            }),
            signal,
        });
        async function* stream() {
            for await (const chunk of (0, fetch_1.streamSse)(response)) {
                const text = chunk?.token?.text ?? "";
                if (text.endsWith("</s>")) {
                    yield text.slice(0, -5);
                }
                else {
                    yield text;
                }
            }
        }
        for await (const text of stream()) {
            yield text;
        }
    }
}
HuggingFaceInferenceAPI.providerName = "huggingface-inference-api";
exports.default = HuggingFaceInferenceAPI;
//# sourceMappingURL=HuggingFaceInferenceAPI.js.map