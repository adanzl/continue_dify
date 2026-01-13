"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenCountingBufferSafety = getTokenCountingBufferSafety;
exports.cleanupAsyncEncoders = cleanupAsyncEncoders;
exports.compileChatMessages = compileChatMessages;
exports.countTokens = countTokens;
exports.countTokensAsync = countTokensAsync;
exports.extractToolSequence = extractToolSequence;
exports.pruneLinesFromBottom = pruneLinesFromBottom;
exports.pruneLinesFromTop = pruneLinesFromTop;
exports.pruneRawPromptFromTop = pruneRawPromptFromTop;
exports.pruneStringFromBottom = pruneStringFromBottom;
exports.pruneStringFromTop = pruneStringFromTop;
const js_tiktoken_1 = require("js-tiktoken");
const autodetect_js_1 = require("./autodetect.js");
const messages_js_1 = require("./messages.js");
const messageContent_js_1 = require("../util/messageContent.js");
const asyncEncoder_js_1 = require("./asyncEncoder.js");
const constants_js_1 = require("./constants.js");
const llamaTokenizer_js_1 = __importDefault(require("./llamaTokenizer.js"));
class LlamaEncoding {
    encode(text) {
        return llamaTokenizer_js_1.default.encode(text);
    }
    decode(tokens) {
        return llamaTokenizer_js_1.default.decode(tokens);
    }
}
class NonWorkerAsyncEncoder {
    constructor(encoding) {
        this.encoding = encoding;
    }
    async close() { }
    async encode(text) {
        return this.encoding.encode(text);
    }
    async decode(tokens) {
        return this.encoding.decode(tokens);
    }
}
let gptEncoding = null;
const llamaEncoding = new LlamaEncoding();
const llamaAsyncEncoder = new asyncEncoder_js_1.LlamaAsyncEncoder();
function asyncEncoderForModel(modelName) {
    // Temporary due to issues packaging the worker files
    if (process.env.IS_BINARY) {
        const encoding = encodingForModel(modelName);
        return new NonWorkerAsyncEncoder(encoding);
    }
    const modelType = (0, autodetect_js_1.autodetectTemplateType)(modelName);
    if (!modelType || modelType === "none") {
        // Right now there is a problem packaging js-tiktoken in workers. Until then falling back
        // Cannot find package 'js-tiktoken' imported from /Users/nate/gh/continuedev/continue/extensions/vscode/out/tiktokenWorkerPool.mjs
        // return gptAsyncEncoder;
        return llamaAsyncEncoder;
    }
    return llamaAsyncEncoder;
}
function encodingForModel(modelName) {
    const modelType = (0, autodetect_js_1.autodetectTemplateType)(modelName);
    if (!modelType || modelType === "none") {
        if (!gptEncoding) {
            gptEncoding = (0, js_tiktoken_1.encodingForModel)("gpt-4");
        }
        return gptEncoding;
    }
    return llamaEncoding;
}
function countImageTokens(content) {
    if (content.type === "imageUrl") {
        return 1024;
    }
    throw new Error("Non-image content type");
}
async function countTokensAsync(content, 
// defaults to llama2 because the tokenizer tends to produce more tokens
modelName = "llama2") {
    const encoding = asyncEncoderForModel(modelName);
    if (Array.isArray(content)) {
        const promises = content.map(async (part) => {
            if (part.type === "imageUrl") {
                return countImageTokens(part);
            }
            return (await encoding.encode(part.text ?? "")).length;
        });
        return (await Promise.all(promises)).reduce((sum, val) => sum + val, 0);
    }
    return (await encoding.encode(content ?? "")).length;
}
function countTokens(content, 
// defaults to llama2 because the tokenizer tends to produce more tokens
modelName = "llama2") {
    const encoding = encodingForModel(modelName);
    if (Array.isArray(content)) {
        return content.reduce((acc, part) => {
            return (acc +
                (part.type === "text"
                    ? encoding.encode(part.text ?? "", "all", []).length
                    : countImageTokens(part)));
        }, 0);
    }
    else {
        return encoding.encode(content ?? "", "all", []).length;
    }
}
// https://community.openai.com/t/how-to-calculate-the-tokens-when-using-function-call/266573/10
function countToolsTokens(tools, modelName) {
    const count = (value) => encodingForModel(modelName).encode(value).length;
    let numTokens = 12;
    for (const tool of tools) {
        let functionTokens = count(tool.function.name);
        if (tool.function.description) {
            functionTokens += count(tool.function.description);
        }
        const props = tool.function.parameters?.properties;
        if (props) {
            for (const key in props) {
                functionTokens += count(key);
                const fields = props[key];
                if (fields) {
                    const fieldType = fields["type"];
                    const fieldDesc = fields["description"];
                    const fieldEnum = fields["enum"];
                    if (fieldType && typeof fieldType === "string") {
                        functionTokens += 2;
                        functionTokens += count(fieldType);
                    }
                    if (fieldDesc && typeof fieldDesc === "string") {
                        functionTokens += 2;
                        functionTokens += count(fieldDesc);
                    }
                    if (fieldEnum && Array.isArray(fieldEnum)) {
                        functionTokens -= 3;
                        for (const e of fieldEnum) {
                            functionTokens += 3;
                            functionTokens += typeof e === "string" ? count(e) : 5;
                        }
                    }
                }
            }
        }
        numTokens += functionTokens;
    }
    return numTokens + 12;
}
function countChatMessageTokens(modelName, chatMessage) {
    // Doing simpler, safer version of what is here:
    // https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
    // every message follows <|im_start|>{role/name}\n{content}<|end|>\n
    const BASE_TOKENS = 4;
    const TOOL_CALL_EXTRA_TOKENS = 10;
    const TOOL_OUTPUT_EXTRA_TOKENS = 10;
    let tokens = BASE_TOKENS;
    if (chatMessage.content) {
        tokens += countTokens(chatMessage.content, modelName);
    }
    if ("toolCalls" in chatMessage && chatMessage.toolCalls) {
        for (const call of chatMessage.toolCalls) {
            tokens += TOOL_CALL_EXTRA_TOKENS;
            tokens += countTokens(JSON.stringify(call), modelName); // TODO hone this
        }
    }
    if (chatMessage.role === "thinking") {
        if (chatMessage.redactedThinking) {
            tokens += countTokens(chatMessage.redactedThinking, modelName);
        }
        if (chatMessage.signature) {
            tokens += countTokens(chatMessage.signature, modelName);
        }
    }
    if (chatMessage.role === "tool") {
        tokens += TOOL_OUTPUT_EXTRA_TOKENS; // safety
        if (chatMessage.toolCallId) {
            tokens += countTokens(chatMessage.toolCallId, modelName);
        }
    }
    return tokens;
}
/**
 * Extracts and validates the tool call sequence from the end of a message array.
 * Tool sequences consist of: [assistant_with_tool_calls, tool_response_1, tool_response_2, ...]
 * or just a single user message.
 *
 * @param messages - Array of chat messages (will be modified by popping messages)
 * @returns Array of messages that form the tool sequence
 */
function extractToolSequence(messages) {
    const lastMsg = messages.pop();
    if (!lastMsg || !(0, messages_js_1.isUserOrToolMsg)(lastMsg)) {
        throw new Error("Error parsing chat history: no user/tool message found");
    }
    const toolSequence = [];
    if (lastMsg.role === "tool") {
        toolSequence.push(lastMsg);
        // Collect all consecutive tool messages from the end
        while (messages.length > 0 &&
            messages[messages.length - 1].role === "tool") {
            toolSequence.unshift(messages.pop());
        }
        // Get the assistant message with tool calls
        const assistantMsg = messages.pop();
        if (assistantMsg) {
            toolSequence.unshift(assistantMsg);
            // Validate that all tool messages have matching tool call IDs
            for (const toolMsg of toolSequence.slice(1)) {
                // Skip assistant message
                if (toolMsg.role === "tool" &&
                    !(0, messages_js_1.messageHasToolCallId)(assistantMsg, toolMsg.toolCallId)) {
                    throw new Error(`Error parsing chat history: no tool call found to match tool output for id "${toolMsg.toolCallId}"`);
                }
            }
        }
    }
    else {
        // Single user message
        toolSequence.push(lastMsg);
    }
    return toolSequence;
}
function pruneLinesFromTop(prompt, maxTokens, modelName) {
    const lines = prompt.split("\n");
    // Preprocess tokens for all lines and cache them.
    const lineTokens = lines.map((line) => countTokens(line, modelName));
    let totalTokens = lineTokens.reduce((sum, tokens) => sum + tokens, 0);
    let start = 0;
    let currentLines = lines.length;
    // Calculate initial token count including newlines
    totalTokens += Math.max(0, currentLines - 1); // Add tokens for joining newlines
    // Using indexes instead of array modifications.
    // Remove lines from the top until the token count is within the limit.
    while (totalTokens > maxTokens && start < currentLines) {
        totalTokens -= lineTokens[start];
        // Decrement token count for the removed line and its preceding/joining newline (if not the last line)
        if (currentLines - start > 1) {
            totalTokens--;
        }
        start++;
    }
    return lines.slice(start).join("\n");
}
function pruneLinesFromBottom(prompt, maxTokens, modelName) {
    const lines = prompt.split("\n");
    const lineTokens = lines.map((line) => countTokens(line, modelName));
    let totalTokens = lineTokens.reduce((sum, tokens) => sum + tokens, 0);
    let end = lines.length;
    // Calculate initial token count including newlines
    totalTokens += Math.max(0, end - 1); // Add tokens for joining newlines
    // Reverse traversal to avoid array modification
    // Remove lines from the bottom until the token count is within the limit.
    while (totalTokens > maxTokens && end > 0) {
        end--;
        totalTokens -= lineTokens[end];
        // Decrement token count for the removed line and its following/joining newline (if not the first line)
        if (end > 0) {
            totalTokens--;
        }
    }
    return lines.slice(0, end).join("\n");
}
function pruneStringFromBottom(modelName, maxTokens, prompt) {
    const encoding = encodingForModel(modelName);
    const tokens = encoding.encode(prompt, "all", []);
    if (tokens.length <= maxTokens) {
        return prompt;
    }
    return encoding.decode(tokens.slice(0, maxTokens));
}
function pruneStringFromTop(modelName, maxTokens, prompt) {
    const encoding = encodingForModel(modelName);
    const tokens = encoding.encode(prompt, "all", []);
    if (tokens.length <= maxTokens) {
        return prompt;
    }
    return encoding.decode(tokens.slice(tokens.length - maxTokens));
}
const MAX_TOKEN_SAFETY_BUFFER = 1000;
const TOKEN_SAFETY_PROPORTION = 0.02;
function getTokenCountingBufferSafety(contextLength) {
    return Math.min(MAX_TOKEN_SAFETY_BUFFER, contextLength * TOKEN_SAFETY_PROPORTION);
}
const MIN_RESPONSE_TOKENS = 1000;
function pruneRawPromptFromTop(modelName, contextLength, prompt, tokensForCompletion) {
    const maxTokens = contextLength -
        tokensForCompletion -
        getTokenCountingBufferSafety(contextLength);
    return pruneStringFromTop(modelName, maxTokens, prompt);
}
/**
 * Reconciles chat messages with available context length by intelligently pruning older messages
 * while preserving critical conversation elements.
 *
 * Core Guidelines:
 * - Always preserve the last user/tool message sequence (including any associated assistant message with tool calls)
 * - Always preserve the system message and tools
 * - Never allow orphaned tool responses without their corresponding tool calls
 * - Remove older messages first when pruning is necessary
 * - Maintain conversation coherence by flattening adjacent similar messages
 *
 * Process:
 * 1. Handle image content conversion for models that don't support images
 * 2. Extract and preserve system message
 * 3. Filter out empty messages and trailing non-user/tool messages
 * 4. Extract the complete tool sequence from the end (user message or assistant + tool responses)
 * 5. Calculate token requirements for non-negotiable elements (system, tools, last sequence)
 * 6. Prune older messages until within available token budget
 * 7. Reassemble with proper ordering and flatten adjacent similar messages
 *
 * @param params - Configuration object containing:
 *   - modelName: LLM model name for token counting
 *   - msgs: Array of chat messages to process
 *   - contextLength: Maximum context length supported by the model
 *   - maxTokens: Maximum tokens to reserve for the response
 *   - supportsImages: Whether the model supports image content
 *   - tools: Optional array of available tools
 * @returns Processed array of chat messages that fit within context constraints
 * @throws Error if non-negotiable elements exceed available context
 */
function compileChatMessages({ modelName, msgs, knownContextLength, maxTokens, supportsImages, tools, }) {
    let didPrune = false;
    let msgsCopy = msgs.map((m) => ({ ...m }));
    // If images not supported, convert MessagePart[] to string
    if (!supportsImages) {
        for (const msg of msgsCopy) {
            if ("content" in msg && Array.isArray(msg.content)) {
                const content = (0, messageContent_js_1.renderChatMessage)(msg);
                msg.content = content;
            }
        }
    }
    // Extract system message
    const systemMsg = msgsCopy.find((msg) => msg.role === "system");
    msgsCopy = msgsCopy.filter((msg) => msg.role !== "system");
    // Remove any empty messages or non-user/tool trailing messages
    msgsCopy = msgsCopy.filter((msg) => !(0, messages_js_1.chatMessageIsEmpty)(msg));
    msgsCopy = (0, messages_js_1.addSpaceToAnyEmptyMessages)(msgsCopy);
    // Extract the tool sequence from the end of the message array
    const toolSequence = extractToolSequence(msgsCopy);
    // Count tokens for all messages in the tool sequence
    let lastMessagesTokens = 0;
    for (const msg of toolSequence) {
        lastMessagesTokens += countChatMessageTokens(modelName, msg);
    }
    // System message
    let systemMsgTokens = 0;
    if (systemMsg) {
        systemMsgTokens = countChatMessageTokens(modelName, systemMsg);
    }
    // Tools
    let toolTokens = 0;
    if (tools) {
        toolTokens = countToolsTokens(tools, modelName);
    }
    const contextLength = knownContextLength ?? constants_js_1.DEFAULT_PRUNING_LENGTH;
    const countingSafetyBuffer = getTokenCountingBufferSafety(contextLength);
    const minOutputTokens = Math.min(MIN_RESPONSE_TOKENS, maxTokens);
    let inputTokensAvailable = contextLength;
    // Leave space for output/safety
    inputTokensAvailable -= countingSafetyBuffer;
    inputTokensAvailable -= minOutputTokens;
    // Non-negotiable messages
    inputTokensAvailable -= toolTokens;
    inputTokensAvailable -= systemMsgTokens;
    inputTokensAvailable -= lastMessagesTokens;
    // Make sure there's enough context for the non-excludable items
    if (knownContextLength !== undefined && inputTokensAvailable < 0) {
        throw new Error(`Not enough context available to include the system message, last user message, and tools.
        There must be at least ${minOutputTokens} tokens remaining for output.
        Request had the following token counts:
        - contextLength: ${knownContextLength}
        - counting safety buffer: ${countingSafetyBuffer}
        - tools: ~${toolTokens}
        - system message: ~${systemMsgTokens}
        - max output tokens: ${maxTokens}`);
    }
    // Now remove messages till we're under the limit
    let currentTotal = 0;
    const historyWithTokens = msgsCopy.map((message) => {
        const tokens = countChatMessageTokens(modelName, message);
        currentTotal += tokens;
        return {
            ...message,
            tokens,
        };
    });
    while (historyWithTokens.length > 0 && currentTotal > inputTokensAvailable) {
        const message = historyWithTokens.shift();
        currentTotal -= message.tokens;
        didPrune = true;
        // At this point make sure no latent tool response without corresponding call
        while (historyWithTokens[0]?.role === "tool") {
            const message = historyWithTokens.shift();
            currentTotal -= message.tokens;
        }
    }
    // Now reassemble
    const reassembled = [];
    if (systemMsg) {
        reassembled.push(systemMsg);
    }
    reassembled.push(...historyWithTokens.map(({ tokens, ...rest }) => rest));
    reassembled.push(...toolSequence);
    const inputTokens = currentTotal + systemMsgTokens + toolTokens + lastMessagesTokens;
    const availableTokens = contextLength - countingSafetyBuffer - minOutputTokens;
    const contextPercentage = inputTokens / availableTokens;
    return {
        compiledChatMessages: reassembled,
        didPrune,
        contextPercentage,
    };
}
async function cleanupAsyncEncoders() {
    try {
        await llamaAsyncEncoder.close();
    }
    catch (e) { }
}
//# sourceMappingURL=countTokens.js.map