"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const edit_js_1 = require("../templates/edit.js");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class OpenRouter extends OpenAI_js_1.default {
    constructor() {
        super(...arguments);
        this.supportsReasoningField = true;
        this.supportsReasoningDetailsField = true;
    }
    /**
     * Detect if the model is an Anthropic/Claude model
     */
    isAnthropicModel(model) {
        if (!model)
            return false;
        const modelLower = model.toLowerCase();
        return modelLower.includes("claude");
    }
    /**
     * Add cache_control to message content for Anthropic models
     */
    addCacheControlToContent(content, addCaching) {
        if (!addCaching)
            return content;
        if (typeof content === "string") {
            return [
                {
                    type: "text",
                    text: content,
                    cache_control: { type: "ephemeral" },
                },
            ];
        }
        if (Array.isArray(content)) {
            // For array content, add cache_control to the last text item
            return content.map((part, idx) => {
                if (part.type === "text" && idx === content.length - 1) {
                    return {
                        ...part,
                        cache_control: { type: "ephemeral" },
                    };
                }
                return part;
            });
        }
        return content;
    }
    /**
     * Override modifyChatBody to add Anthropic caching when appropriate
     */
    modifyChatBody(body) {
        // First apply parent modifications
        body = super.modifyChatBody(body);
        // Check if we should apply Anthropic caching
        if (!this.isAnthropicModel(body.model) ||
            (!this.cacheBehavior && !this.completionOptions.promptCaching)) {
            return body;
        }
        const shouldCacheConversation = this.cacheBehavior?.cacheConversation ||
            this.completionOptions.promptCaching;
        const shouldCacheSystemMessage = this.cacheBehavior?.cacheSystemMessage ||
            this.completionOptions.promptCaching;
        if (!shouldCacheConversation && !shouldCacheSystemMessage) {
            return body;
        }
        // Follow the same logic as Anthropic.ts: filter out system messages first
        const filteredMessages = body.messages.filter((m) => m.role !== "system" && !!m.content);
        // Find the last two user message indices from the filtered array
        const lastTwoUserMsgIndices = filteredMessages
            .map((msg, index) => (msg.role === "user" ? index : -1))
            .filter((index) => index !== -1)
            .slice(-2);
        // Create a mapping from filtered indices to original indices
        let filteredIndex = 0;
        const filteredToOriginalIndexMap = [];
        body.messages.forEach((msg, originalIndex) => {
            if (msg.role !== "system" && !!msg.content) {
                filteredToOriginalIndexMap[filteredIndex] = originalIndex;
                filteredIndex++;
            }
        });
        // Modify messages to add cache_control
        body.messages = body.messages.map((message, idx) => {
            // Handle system message caching
            if (message.role === "system" && shouldCacheSystemMessage) {
                return {
                    ...message,
                    content: this.addCacheControlToContent(message.content, true),
                };
            }
            // Handle conversation caching for last two user messages
            // Check if this message's index (in filtered array) is one of the last two user messages
            const filteredIdx = filteredToOriginalIndexMap.indexOf(idx);
            if (message.role === "user" &&
                shouldCacheConversation &&
                filteredIdx !== -1 &&
                lastTwoUserMsgIndices.includes(filteredIdx)) {
                return {
                    ...message,
                    content: this.addCacheControlToContent(message.content, true),
                };
            }
            return message;
        });
        return body;
    }
}
OpenRouter.providerName = "openrouter";
OpenRouter.defaultOptions = {
    apiBase: "https://openrouter.ai/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
        edit: edit_js_1.osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
};
exports.default = OpenRouter;
//# sourceMappingURL=OpenRouter.js.map