"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const messageContent_js_1 = require("../../util/messageContent.js");
const index_js_1 = require("../index.js");
class Cloudflare extends index_js_1.BaseLLM {
    _convertArgs(options) {
        const finalOptions = {
            max_tokens: options.maxTokens,
        };
        return finalOptions;
    }
    async *_streamChat(messages, signal, options) {
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...this.requestOptions?.headers,
        };
        const url = this.aiGatewaySlug
            ? `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.aiGatewaySlug}/workers-ai/v1/chat/completions`
            : `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`;
        const resp = await this.fetch(new URL(url), {
            method: "POST",
            headers,
            body: JSON.stringify({
                messages,
                stream: true,
                model: this.model,
                ...this._convertArgs(options),
            }),
            signal,
        });
        for await (const value of (0, fetch_1.streamSse)(resp)) {
            if (value.choices?.[0]?.delta?.content) {
                yield {
                    role: "assistant",
                    content: value.choices[0].delta.content,
                };
            }
        }
    }
    async *_streamComplete(prompt, signal, options) {
        for await (const chunk of this._streamChat([{ role: "user", content: prompt }], signal, options)) {
            yield (0, messageContent_js_1.renderChatMessage)(chunk);
        }
    }
}
Cloudflare.providerName = "cloudflare";
exports.default = Cloudflare;
//# sourceMappingURL=Cloudflare.js.map