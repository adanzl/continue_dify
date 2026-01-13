"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Cerebras extends OpenAI_js_1.default {
    constructor(options) {
        super(options);
        this.maxStopWords = 4;
        // Set context length based on whether the model is the free version
        if (options.model === "qwen-3-coder-480b-free") {
            this._contextLength = 64000;
        }
        else if (options.model === "qwen-3-coder-480b") {
            this._contextLength = 128000;
        }
    }
    filterThinkingTags(content) {
        // Remove <thinking>...</thinking> tags (including multiline)
        return content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
    }
    filterThinkingFromMessages(messages) {
        return messages.map((message) => {
            if (typeof message.content === "string") {
                return {
                    ...message,
                    content: this.filterThinkingTags(message.content),
                };
            }
            else if (Array.isArray(message.content)) {
                return {
                    ...message,
                    content: message.content.map((part) => {
                        if (part.type === "text" && typeof part.text === "string") {
                            return {
                                ...part,
                                text: this.filterThinkingTags(part.text),
                            };
                        }
                        return part;
                    }),
                };
            }
            return message;
        });
    }
    _convertArgs(options, messages) {
        // Filter thinking tags from messages before processing
        const filteredMessages = this.filterThinkingFromMessages(messages);
        return super._convertArgs(options, filteredMessages);
    }
    _convertModelName(model) {
        return Cerebras.modelConversion[model] ?? model;
    }
}
Cerebras.providerName = "cerebras";
Cerebras.defaultOptions = {
    apiBase: "https://api.cerebras.ai/v1/",
};
Cerebras.modelConversion = {
    "qwen-3-coder-480b-free": "qwen-3-coder-480b", // Maps free version to base model
    "qwen-3-coder-480b": "qwen-3-coder-480b",
    "qwen-3-235b-a22b-instruct-2507": "qwen-3-235b-a22b-instruct-2507",
    "llama-3.3-70b": "llama-3.3-70b",
    "qwen-3-32b": "qwen-3-32b",
    "qwen-3-235b-a22b-thinking-2507": "qwen-3-235b-a22b-thinking-2507",
};
exports.default = Cerebras;
//# sourceMappingURL=Cerebras.js.map