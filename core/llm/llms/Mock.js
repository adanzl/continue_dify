"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class MockLLM extends index_js_1.BaseLLM {
    constructor(options) {
        super(options);
        this.completion = "Test Completion";
        this.templateMessages = undefined;
        this.chatStreams = options.requestOptions?.extraBodyProperties?.chatStream;
    }
    async *_streamComplete(prompt, signal, options) {
        yield this.completion;
    }
    async *_streamChat(messages, signal, options) {
        if (this.chatStreams) {
            const chatStream = this.chatStreams?.[messages.filter((m) => m.role === "user" || m.role === "tool")
                .length - 1];
            if (chatStream) {
                for (const message of chatStream) {
                    switch (message) {
                        case "REPEAT_LAST_MSG":
                            yield {
                                role: "assistant",
                                content: messages[messages.length - 1].content,
                            };
                            break;
                        case "REPEAT_SYSTEM_MSG":
                            yield {
                                role: "assistant",
                                content: messages.find((m) => m.role === "system")?.content || "",
                            };
                            break;
                        case "ERROR":
                            throw new Error("Intentional error");
                        default:
                            yield message;
                    }
                }
            }
            return;
        }
        for (const char of this.completion) {
            yield {
                role: "assistant",
                content: char,
            };
        }
    }
}
MockLLM.providerName = "mock";
exports.default = MockLLM;
//# sourceMappingURL=Mock.js.map