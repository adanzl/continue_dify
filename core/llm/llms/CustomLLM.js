"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messageContent_js_1 = require("../../util/messageContent.js");
const index_js_1 = require("../index.js");
class CustomLLMClass extends index_js_1.BaseLLM {
    get providerName() {
        return "custom";
    }
    constructor(custom) {
        super(custom.options || { model: "custom" });
        this.customStreamCompletion = custom.streamCompletion;
        this.customStreamChat = custom.streamChat;
    }
    async *_streamChat(messages, signal, options) {
        if (this.customStreamChat) {
            for await (const content of this.customStreamChat(messages, signal, options, (...args) => this.fetch(...args))) {
                if (typeof content === "string") {
                    yield { role: "assistant", content };
                }
                else {
                    yield content;
                }
            }
        }
        else {
            for await (const update of super._streamChat(messages, signal, options)) {
                yield update;
            }
        }
    }
    async *_streamComplete(prompt, signal, options) {
        if (this.customStreamCompletion) {
            for await (const content of this.customStreamCompletion(prompt, signal, options, (...args) => this.fetch(...args))) {
                yield content;
            }
        }
        else if (this.customStreamChat) {
            for await (const content of this.customStreamChat([{ role: "user", content: prompt }], signal, options, (...args) => this.fetch(...args))) {
                if (typeof content === "string") {
                    yield content;
                }
                else {
                    yield (0, messageContent_js_1.renderChatMessage)(content);
                }
            }
        }
        else {
            throw new Error("Either streamCompletion or streamChat must be defined in a custom LLM in config.ts");
        }
    }
}
exports.default = CustomLLMClass;
//# sourceMappingURL=CustomLLM.js.map