"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const uuid_1 = require("uuid");
const parseArgs_js_1 = require("../../tools/parseArgs.js");
const messageContent_js_1 = require("../../util/messageContent.js");
const url_js_1 = require("../../util/url.js");
const index_js_1 = require("../index.js");
const gemini_types_1 = require("./gemini-types");
class Gemini extends index_js_1.BaseLLM {
    constructor() {
        super(...arguments);
        this.useOpenAIAdapterFor = [
            "chat",
            "embed",
            "list",
            "rerank",
            "streamChat",
            "streamFim",
        ];
    }
    // Function to convert completion options to Gemini format
    convertArgs(options) {
        // should be public for use within VertexAI
        const finalOptions = {}; // Initialize an empty object
        // Map known options
        if (options.topK) {
            finalOptions.topK = options.topK;
        }
        if (options.topP) {
            finalOptions.topP = options.topP;
        }
        if (options.temperature !== undefined && options.temperature !== null) {
            finalOptions.temperature = options.temperature;
        }
        if (options.maxTokens) {
            finalOptions.maxOutputTokens = options.maxTokens;
        }
        if (options.stop) {
            finalOptions.stopSequences = options.stop
                .filter((x) => x.trim() !== "")
                .slice(0, this.maxStopWords ?? Gemini.defaultOptions.maxStopWords);
        }
        return finalOptions;
    }
    async *_streamComplete(prompt, signal, options) {
        for await (const message of this._streamChat([{ content: prompt, role: "user" }], signal, options)) {
            yield (0, messageContent_js_1.renderChatMessage)(message);
        }
    }
    /**
     * Removes the system message and merges it with the next user message if present.
     * @param messages Array of chat messages
     * @returns Modified array with system message merged into user message if applicable
     */
    removeSystemMessage(messages) {
        // If no messages or first message isn't system, return copy of original messages
        if (messages.length === 0 || messages[0]?.role !== "system") {
            return [...messages];
        }
        // Extract system message
        const systemMessage = messages[0];
        // Extract system content based on its type
        let systemContent = "";
        if (typeof systemMessage.content === "string") {
            systemContent = systemMessage.content;
        }
        else if (Array.isArray(systemMessage.content)) {
            const contentArray = systemMessage.content;
            const concatenatedText = contentArray
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join(" ");
            systemContent = concatenatedText ? concatenatedText : "";
        }
        else if (systemMessage.content &&
            typeof systemMessage.content === "object") {
            const typedContent = systemMessage.content;
            systemContent = typedContent?.text || "";
        }
        // Create new array without the system message
        const remainingMessages = messages.slice(1);
        // Check if there's a user message to merge with
        if (remainingMessages.length > 0 && remainingMessages[0].role === "user") {
            const userMessage = remainingMessages[0];
            const prefix = `System message - follow these instructions in every response: ${systemContent}\n\n---\n\n`;
            // Merge based on user content type
            if (typeof userMessage.content === "string") {
                userMessage.content = prefix + userMessage.content;
            }
            else if (Array.isArray(userMessage.content)) {
                const contentArray = userMessage.content;
                const textPart = contentArray.find((part) => part.type === "text");
                if (textPart) {
                    textPart.text = prefix + textPart.text;
                }
                else {
                    userMessage.content.push({
                        type: "text",
                        text: prefix,
                    });
                }
            }
            else if (userMessage.content &&
                typeof userMessage.content === "object") {
                const typedContent = userMessage.content;
                userMessage.content = [
                    {
                        type: "text",
                        text: prefix + (typedContent.text || ""),
                    },
                ];
            }
        }
        return remainingMessages;
    }
    async *_streamChat(messages, signal, options) {
        const isV1API = this.apiBase?.includes("/v1/");
        const convertedMsgs = isV1API
            ? this.removeSystemMessage(messages)
            : messages;
        if (options.model.includes("bison")) {
            for await (const message of this.streamChatBison(convertedMsgs, signal, options)) {
                yield message;
            }
        }
        else {
            for await (const message of this.streamChatGemini(convertedMsgs, signal, options)) {
                yield message;
            }
        }
    }
    continuePartToGeminiPart(part) {
        if (part.type === "text") {
            return {
                text: part.text,
            };
        }
        let data = "";
        if (part.imageUrl?.url) {
            const extracted = (0, url_js_1.extractBase64FromDataUrl)(part.imageUrl.url);
            if (extracted) {
                data = extracted;
            }
            else {
                console.warn("Gemini: skipping image with invalid data URL format", part.imageUrl.url);
            }
        }
        return {
            inlineData: {
                mimeType: "image/jpeg",
                data,
            },
        };
    }
    prepareBody(messages, options, isV1API, includeToolIds) {
        const toolCallIdToNameMap = new Map();
        messages.forEach((msg) => {
            if (msg.role === "assistant" && msg.toolCalls) {
                msg.toolCalls.forEach((call) => {
                    if (call.id && call.function?.name) {
                        toolCallIdToNameMap.set(call.id, call.function.name);
                    }
                });
            }
        });
        const systemMessage = messages.find((msg) => msg.role === "system")?.content;
        const body = {
            contents: messages
                .filter((msg) => !(msg.role === "system" && isV1API))
                .map((msg) => {
                if (msg.role === "tool") {
                    let functionName = toolCallIdToNameMap.get(msg.toolCallId);
                    if (!functionName) {
                        console.warn("Sending tool call response for unidentified tool call");
                    }
                    return {
                        role: "user",
                        parts: [
                            {
                                functionResponse: {
                                    id: includeToolIds ? msg.toolCallId : undefined,
                                    name: functionName || "unknown",
                                    response: {
                                        output: msg.content, // "output" key is opinionated - not all functions will output objects
                                    },
                                },
                            },
                        ],
                    };
                }
                if (msg.role === "assistant") {
                    const assistantMsg = {
                        role: "model",
                        parts: typeof msg.content === "string"
                            ? [{ text: msg.content }]
                            : msg.content.map(this.continuePartToGeminiPart),
                    };
                    if (msg.toolCalls && msg.toolCalls.length) {
                        msg.toolCalls.forEach((toolCall, index) => {
                            if (toolCall.function?.name) {
                                const signatureForCall = toolCall?.extra_content?.google?.thought_signature;
                                let thoughtSignature;
                                if (index === 0) {
                                    if (typeof signatureForCall === "string") {
                                        thoughtSignature = signatureForCall;
                                    }
                                    else {
                                        // Fallback per https://ai.google.dev/gemini-api/docs/thought-signatures
                                        // for histories that were not generated by Gemini or are missing signatures.
                                        thoughtSignature = "skip_thought_signature_validator";
                                    }
                                }
                                assistantMsg.parts.push({
                                    functionCall: {
                                        name: toolCall.function.name,
                                        args: (0, parseArgs_js_1.safeParseToolCallArgs)(toolCall),
                                    },
                                    ...(thoughtSignature && { thoughtSignature }),
                                });
                            }
                        });
                    }
                    return assistantMsg;
                }
                return {
                    role: "user",
                    parts: typeof msg.content === "string"
                        ? [{ text: msg.content }]
                        : msg.content.map(this.continuePartToGeminiPart),
                };
            }),
        };
        if (options) {
            body.generationConfig = this.convertArgs(options);
        }
        // https://ai.google.dev/gemini-api/docs/api-versions
        if (!isV1API) {
            if (systemMessage) {
                body.systemInstruction = {
                    parts: [{ text: (0, messageContent_js_1.stripImages)(systemMessage) }],
                };
            }
            // Convert and add tools if present
            if (options.tools?.length) {
                // Choosing to map all tools to the functionDeclarations of one tool
                // Rather than map each tool to its own tool + functionDeclaration
                // Same difference
                const functions = [];
                options.tools.forEach((tool) => {
                    try {
                        functions.push((0, gemini_types_1.convertContinueToolToGeminiFunction)(tool));
                    }
                    catch (e) {
                        console.warn(`Failed to convert tool to gemini function definition. Skipping: ${JSON.stringify(tool, null, 2)}`);
                    }
                });
                if (functions.length) {
                    body.tools = [
                        {
                            functionDeclarations: functions,
                        },
                    ];
                }
            }
        }
        return body;
    }
    async *processGeminiResponse(stream) {
        let buffer = "";
        for await (const chunk of stream) {
            buffer += chunk;
            if (buffer.startsWith("[")) {
                buffer = buffer.slice(1);
            }
            if (buffer.endsWith("]")) {
                buffer = buffer.slice(0, -1);
            }
            if (buffer.startsWith(",")) {
                buffer = buffer.slice(1);
            }
            const parts = buffer.split("\n,");
            let foundIncomplete = false;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                let data;
                try {
                    data = JSON.parse(part);
                }
                catch (e) {
                    foundIncomplete = true;
                    continue; // yo!
                }
                if ("error" in data) {
                    throw new Error(data.error.message);
                }
                // In case of max tokens reached, gemini will sometimes return content with no parts, even though that doesn't match the API spec
                const contentParts = data?.candidates?.[0]?.content?.parts;
                if (contentParts) {
                    const textParts = [];
                    const toolCalls = [];
                    for (const part of contentParts) {
                        if ("text" in part) {
                            textParts.push({ type: "text", text: part.text });
                        }
                        else if ("functionCall" in part) {
                            const thoughtSignature = part.thoughtSignature;
                            toolCalls.push({
                                type: "function",
                                id: part.functionCall.id ?? (0, uuid_1.v4)(),
                                function: {
                                    name: part.functionCall.name,
                                    arguments: typeof part.functionCall.args === "string"
                                        ? part.functionCall.args
                                        : JSON.stringify(part.functionCall.args),
                                },
                                ...(thoughtSignature && {
                                    extra_content: {
                                        google: {
                                            thought_signature: thoughtSignature,
                                        },
                                    },
                                }),
                            });
                        }
                        else {
                            // Note: function responses shouldn't be streamed, images not supported
                            console.warn("Unsupported gemini part type received", part);
                        }
                    }
                    const assistantMessage = {
                        role: "assistant",
                        content: textParts.length ? textParts : "",
                    };
                    if (toolCalls.length > 0) {
                        assistantMessage.toolCalls = toolCalls;
                    }
                    if (textParts.length || toolCalls.length) {
                        yield assistantMessage;
                    }
                }
                else {
                    // Handle the case where the expected data structure is not found
                    console.warn("Unexpected response format:", data);
                }
            }
            if (foundIncomplete) {
                buffer = parts[parts.length - 1];
            }
            else {
                buffer = "";
            }
        }
    }
    async *streamChatGemini(messages, signal, options) {
        const apiURL = new URL(`models/${options.model}:streamGenerateContent?key=${this.apiKey}`, this.apiBase);
        const isV1API = !!this.apiBase?.includes("/v1/");
        // Convert chat messages to contents
        const body = this.prepareBody(messages, options, isV1API, true);
        const response = await this.fetch(apiURL, {
            method: "POST",
            body: JSON.stringify(body),
            signal,
        });
        for await (const message of this.processGeminiResponse((0, fetch_1.streamResponse)(response))) {
            yield message;
        }
    }
    async *streamChatBison(messages, signal, options) {
        const msgList = [];
        for (const message of messages) {
            msgList.push({ content: message.content });
        }
        const apiURL = new URL(`models/${options.model}:generateMessage?key=${this.apiKey}`, this.apiBase);
        const body = { prompt: { messages: msgList } };
        const response = await this.fetch(apiURL, {
            method: "POST",
            body: JSON.stringify(body),
            signal,
        });
        if (response.status === 499) {
            return; // Aborted by user
        }
        const data = await response.json();
        yield { role: "assistant", content: data.candidates[0].content };
    }
    async _embed(batch) {
        // Batch embed endpoint: https://ai.google.dev/api/embeddings?authuser=1#EmbedContentRequest
        const requests = batch.map((text) => ({
            model: this.model,
            content: {
                role: "user",
                parts: [{ text }],
            },
        }));
        const resp = await this.fetch(new URL(`${this.model}:batchEmbedContents`, this.apiBase), {
            method: "POST",
            body: JSON.stringify({
                requests,
            }),
            headers: {
                "x-goog-api-key": this.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const data = (await resp.json());
        return data.embeddings.map((embedding) => embedding.values);
    }
}
Gemini.providerName = "gemini";
Gemini.defaultOptions = {
    model: "gemini-pro",
    apiBase: "https://generativelanguage.googleapis.com/v1beta/",
    maxStopWords: 5,
    maxEmbeddingBatchSize: 100,
};
exports.default = Gemini;
//# sourceMappingURL=Gemini.js.map