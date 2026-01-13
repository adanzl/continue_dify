"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const index_js_1 = require("../index.js");
class LlamaCpp extends index_js_1.BaseLLM {
    _convertArgs(options, prompt) {
        const finalOptions = {
            n_predict: options.maxTokens,
            frequency_penalty: options.frequencyPenalty,
            presence_penalty: options.presencePenalty,
            min_p: options.minP,
            mirostat: options.mirostat,
            stop: options.stop,
            top_k: options.topK,
            top_p: options.topP,
            temperature: options.temperature,
        };
        return finalOptions;
    }
    async *_streamComplete(prompt, signal, options) {
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...this.requestOptions?.headers,
        };
        const resp = await this.fetch(new URL("completion", this.apiBase), {
            method: "POST",
            headers,
            body: JSON.stringify({
                prompt,
                stream: true,
                ...this._convertArgs(options, prompt),
            }),
            signal,
        });
        for await (const value of (0, fetch_1.streamSse)(resp)) {
            if (value.content) {
                yield value.content;
            }
        }
    }
}
LlamaCpp.providerName = "llama.cpp";
LlamaCpp.defaultOptions = {
    apiBase: "http://127.0.0.1:8080/",
};
exports.default = LlamaCpp;
//# sourceMappingURL=LlamaCpp.js.map