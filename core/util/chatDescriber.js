"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatDescriber = void 0;
const _1 = require(".");
const messageContent_1 = require("./messageContent");
const messageConversion_1 = require("./messageConversion");
class ChatDescriber {
    static async describe(model, completionOptions, message) {
        if (!ChatDescriber.prompt) {
            return;
        }
        // Clean up and distill the message we want to send to the LLM
        message = (0, _1.removeCodeBlocksAndTrim)(message);
        if (!message) {
            return;
        }
        completionOptions.maxTokens = ChatDescriber.maxTokens;
        // Prompt the user's current LLM for the title
        const titleResponse = await model.chat([
            {
                role: "user",
                content: ChatDescriber.prompt + message,
            },
        ], new AbortController().signal, completionOptions);
        // Set the title
        return (0, _1.removeQuotesAndEscapes)((0, messageContent_1.renderChatMessage)(titleResponse));
    }
    // CLI-specific method that works with BaseLlmApi
    static async describeWithBaseLlmApi(llmApi, // BaseLlmApi - using any to avoid import issues
    modelConfig, // ModelConfig - using any to avoid import issues
    message) {
        if (!ChatDescriber.prompt) {
            return;
        }
        // Clean up and distill the message we want to send to the LLM
        message = (0, _1.removeCodeBlocksAndTrim)(message);
        if (!message) {
            return;
        }
        try {
            // Create the chat message in the unified format
            const chatMessage = {
                role: "user",
                content: ChatDescriber.prompt + message,
            };
            // Convert to OpenAI format - use a simple fallback to avoid import issues
            const openaiMessages = (0, messageConversion_1.convertFromUnifiedHistory)([
                {
                    message: chatMessage,
                    contextItems: [],
                },
            ]);
            // Set up completion options for non-streaming
            const completionOptions = {
                model: modelConfig.model,
                messages: openaiMessages,
                max_tokens: ChatDescriber.maxTokens,
                stream: false,
            };
            // Call the LLM
            const titleResponse = await llmApi.chatCompletionNonStream(completionOptions, new AbortController().signal);
            // Extract and clean up the response
            if (titleResponse.choices && titleResponse.choices.length > 0) {
                const content = titleResponse.choices[0].message.content;
                if (content) {
                    return (0, _1.removeQuotesAndEscapes)(content);
                }
            }
            return undefined;
        }
        catch (error) {
            return undefined;
        }
    }
}
exports.ChatDescriber = ChatDescriber;
ChatDescriber.maxTokens = 16; // Increased from 12 to meet GPT-5 minimum requirement
ChatDescriber.prompt = "Given the following... please reply with a title for the chat that is 3-4 words in length, all words used should be directly related to the content of the chat, avoid using verbs unless they are directly related to the content of the chat, no additional text or explanation, you don't need ending punctuation.\n\n";
//# sourceMappingURL=chatDescriber.js.map