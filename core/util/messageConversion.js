"use strict";
/**
 * Message conversion utilities for transitioning to unified ChatHistoryItem type.
 *
 * This module provides conversion functions between the OpenAI ChatCompletionMessageParam
 * format and the unified ChatHistoryItem format from the core package.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToUnifiedMessage = convertToUnifiedMessage;
exports.convertFromUnifiedMessage = convertFromUnifiedMessage;
exports.createHistoryItem = createHistoryItem;
exports.convertToUnifiedHistory = convertToUnifiedHistory;
exports.convertFromUnifiedHistory = convertFromUnifiedHistory;
exports.convertFromUnifiedHistoryWithSystemMessage = convertFromUnifiedHistoryWithSystemMessage;
exports.extractToolCallInfo = extractToolCallInfo;
/**
 * Convert ChatCompletionMessageParam to ChatMessage
 */
function convertToUnifiedMessage(message) {
    switch (message.role) {
        case "system":
            return {
                role: "system",
                content: typeof message.content === "string" ? message.content : "",
            };
        case "user":
            return {
                role: "user",
                content: convertMessageContent(message.content),
            };
        case "assistant": {
            const assistantMessage = {
                role: "assistant",
                content: convertMessageContent(message.content || ""),
            };
            // Convert tool calls if present
            if ("tool_calls" in message && message.tool_calls) {
                assistantMessage.toolCalls = message.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: {
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                    },
                }));
            }
            return assistantMessage;
        }
        case "tool":
            return {
                role: "tool",
                content: typeof message.content === "string" ? message.content : "",
                toolCallId: message.tool_call_id,
            };
        default:
            throw new Error(`Unsupported message role: ${message.role}`);
    }
}
/**
 * Convert ChatMessage to ChatCompletionMessageParam
 */
function convertFromUnifiedMessage(message) {
    switch (message.role) {
        case "system":
            return {
                role: "system",
                content: message.content,
            };
        case "user":
            return {
                role: "user",
                content: convertFromMessageContent(message.content),
            };
        case "assistant": {
            const assistantMessage = {
                role: "assistant",
                content: convertFromMessageContent(message.content),
            };
            // Convert tool calls if present
            if (message.toolCalls && message.toolCalls.length > 0) {
                assistantMessage.tool_calls = message.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: {
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                    },
                }));
            }
            return assistantMessage;
        }
        case "tool":
            return {
                role: "tool",
                content: message.content,
                tool_call_id: message.toolCallId,
            };
        case "thinking":
            // Thinking messages don't have a direct equivalent in OpenAI format
            // Convert to assistant message with content
            return {
                role: "assistant",
                content: convertFromMessageContent(message.content),
            };
        default:
            throw new Error(`Unsupported message role: ${message.role}`);
    }
}
/**
 * Convert OpenAI message content to unified MessageContent format
 */
function convertMessageContent(content) {
    if (content === null) {
        return "";
    }
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part.type === "text") {
                return {
                    type: "text",
                    text: part.text,
                };
            }
            else if (part.type === "image_url") {
                return {
                    type: "imageUrl",
                    imageUrl: { url: part.image_url.url },
                };
            }
            throw new Error(`Unsupported content part type: ${part.type}`);
        });
    }
    throw new Error(`Unsupported content type: ${typeof content}`);
}
/**
 * Convert unified MessageContent to OpenAI format
 */
function convertFromMessageContent(content) {
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (part.type === "text") {
                return {
                    type: "text",
                    text: part.text,
                };
            }
            else if (part.type === "imageUrl") {
                return {
                    type: "image_url",
                    image_url: { url: part.imageUrl.url },
                };
            }
            throw new Error(`Unsupported content part type: ${part.type}`);
        });
    }
    throw new Error(`Unsupported content type: ${typeof content}`);
}
/**
 * Create a ChatHistoryItem from a ChatMessage
 */
function createHistoryItem(message, contextItems = [], toolCallStates) {
    return {
        message,
        contextItems,
        ...(toolCallStates && { toolCallStates }),
    };
}
/**
 * Handle tool result message by updating the corresponding tool call state
 */
function handleToolResult(unifiedMessage, pendingToolCalls, historyItems) {
    const toolCall = pendingToolCalls.get(unifiedMessage.toolCallId);
    if (!toolCall)
        return;
    // Add tool result as context to the previous assistant message
    let lastAssistantIndex = -1;
    for (let i = historyItems.length - 1; i >= 0; i--) {
        if (historyItems[i].message.role === "assistant") {
            lastAssistantIndex = i;
            break;
        }
    }
    if (lastAssistantIndex < 0)
        return;
    if (!historyItems[lastAssistantIndex].toolCallStates)
        return;
    const toolState = historyItems[lastAssistantIndex].toolCallStates?.find((ts) => ts.toolCallId === unifiedMessage.toolCallId);
    if (toolState) {
        toolState.output = [
            {
                content: unifiedMessage.content,
                name: `Tool Result: ${toolCall.function.name}`,
                description: "Tool execution result",
            },
        ];
    }
}
/**
 * Convert array of ChatCompletionMessageParam to ChatHistoryItem array
 */
function convertToUnifiedHistory(messages) {
    const historyItems = [];
    const pendingToolCalls = new Map();
    for (const message of messages) {
        const unifiedMessage = convertToUnifiedMessage(message);
        if (unifiedMessage.role === "assistant" && unifiedMessage.toolCalls) {
            // Store tool calls for matching with results
            const toolCallStates = unifiedMessage.toolCalls.map((tc) => {
                const toolCall = {
                    id: tc.id || "",
                    type: "function",
                    function: {
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                    },
                };
                pendingToolCalls.set(toolCall.id, toolCall);
                return {
                    toolCallId: toolCall.id,
                    toolCall,
                    status: "done", // Historical calls are complete
                    parsedArgs: tryParseJson(toolCall.function.arguments),
                };
            });
            historyItems.push(createHistoryItem(unifiedMessage, [], toolCallStates));
        }
        else if (unifiedMessage.role === "tool") {
            // Tool result - handle separately to reduce nesting
            handleToolResult(unifiedMessage, pendingToolCalls, historyItems);
            // Don't add tool messages as separate history items
        }
        else {
            historyItems.push(createHistoryItem(unifiedMessage));
        }
    }
    return historyItems;
}
/**
 * Convert ChatHistoryItem array to ChatCompletionMessageParam array
 */
function convertFromUnifiedHistory(historyItems) {
    const messages = [];
    for (const item of historyItems) {
        const baseMessage = convertFromUnifiedMessage(item.message);
        // If this is a user message with context items, expand the content
        if (item.message.role === "user" &&
            item.contextItems &&
            item.contextItems.length > 0) {
            const contextContent = item.contextItems
                .map((contextItem) => `<context name="${contextItem.name}">\n${contextItem.content}\n</context>\n\n`)
                .join("");
            baseMessage.content =
                typeof baseMessage.content === "string"
                    ? contextContent + baseMessage.content
                    : baseMessage.content; // Keep array format if it's already an array
        }
        messages.push(baseMessage);
        // Add tool result messages if there are completed tool calls
        if (item.toolCallStates) {
            for (const toolState of item.toolCallStates) {
                if (toolState.output && toolState.output.length > 0) {
                    messages.push({
                        role: "tool",
                        content: toolState.output.map((o) => o.content).join("\n"),
                        tool_call_id: toolState.toolCallId,
                    });
                }
            }
        }
    }
    return messages;
}
/**
 * Convert ChatHistoryItem array to ChatCompletionMessageParam array with injected system message
 * @param historyItems - The chat history items
 * @param systemMessage - The system message to inject at the beginning
 */
function convertFromUnifiedHistoryWithSystemMessage(historyItems, systemMessage) {
    const messages = [];
    // Inject system message at the beginning
    messages.push({
        role: "system",
        content: systemMessage,
    });
    // Convert the rest of the history
    const convertedMessages = convertFromUnifiedHistory(historyItems);
    messages.push(...convertedMessages);
    return messages;
}
/**
 * Extract tool call information from a ChatHistoryItem
 */
function extractToolCallInfo(historyItem) {
    const hasToolCalls = !!(historyItem.toolCallStates && historyItem.toolCallStates.length > 0);
    return {
        hasToolCalls,
        toolCalls: historyItem.toolCallStates?.map((ts) => ts.toolCall),
        toolStates: historyItem.toolCallStates,
    };
}
/**
 * Helper to safely parse JSON
 */
function tryParseJson(str) {
    try {
        return JSON.parse(str);
    }
    catch {
        return str;
    }
}
//# sourceMappingURL=messageConversion.js.map