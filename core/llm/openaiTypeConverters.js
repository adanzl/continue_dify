"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toChatMessage = toChatMessage;
exports.toChatBody = toChatBody;
exports.toCompleteBody = toCompleteBody;
exports.toFimBody = toFimBody;
exports.fromChatResponse = fromChatResponse;
exports.fromChatCompletionChunk = fromChatCompletionChunk;
exports.fromResponsesChunk = fromResponsesChunk;
exports.mergeReasoningDetails = mergeReasoningDetails;
exports.toResponsesInput = toResponsesInput;
function appendReasoningFieldsIfSupported(msg, options, prevMessage, providerFlags) {
    if (!prevMessage || prevMessage.role !== "thinking")
        return;
    const includeReasoning = !!providerFlags?.includeReasoningField;
    const includeReasoningDetails = !!providerFlags?.includeReasoningDetailsField;
    if (!includeReasoning && !includeReasoningDetails)
        return;
    const reasoningDetailsValue = prevMessage.reasoning_details ||
        (prevMessage.signature
            ? [{ signature: prevMessage.signature }]
            : undefined);
    // Claude-specific safeguard: prevent errors when switching to Claude after another model.
    // Claude requires a signed reasoning_details block; if missing, we must omit both fields.
    // This check is done before adding any fields to avoid deletes.
    if (includeReasoningDetails &&
        options.model.includes("claude") &&
        !(Array.isArray(reasoningDetailsValue) &&
            reasoningDetailsValue.some((d) => d && d.signature))) {
        console.warn("Omitting reasoning fields for Claude: no signature present in reasoning_details");
        return;
    }
    if (includeReasoningDetails && reasoningDetailsValue) {
        msg.reasoning_details = reasoningDetailsValue || [];
    }
    if (includeReasoning) {
        msg.reasoning = prevMessage.content;
    }
}
function toChatMessage(message, options, prevMessage, providerFlags) {
    if (message.role === "tool") {
        return {
            role: "tool",
            content: message.content,
            tool_call_id: message.toolCallId,
        };
    }
    if (message.role === "system") {
        return {
            role: "system",
            content: message.content,
        };
    }
    if (message.role === "thinking") {
        // Return null - thinking messages are merged into following assistant messages
        return null;
    }
    if (message.role === "assistant") {
        // Base assistant message
        const msg = {
            role: "assistant",
            content: typeof message.content === "string"
                ? message.content || " " // LM Studio (and other providers) don't accept empty content
                : message.content
                    .filter((part) => part.type === "text")
                    .map((part) => part),
        };
        // Add tool calls if present
        if (message.toolCalls) {
            msg.tool_calls = message.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: toolCall.type,
                function: {
                    name: toolCall.function?.name,
                    arguments: toolCall.function?.arguments || "{}",
                },
            }));
        }
        // Preserving reasoning blocks
        appendReasoningFieldsIfSupported(msg, options, prevMessage, providerFlags);
        return msg;
    }
    else {
        if (typeof message.content === "string") {
            return {
                role: "user",
                content: message.content ?? " ", // LM Studio (and other providers) don't accept empty content
            };
        }
        // If no multi-media is in the message, just send as text
        // for compatibility with OpenAI-"compatible" servers
        // that don't support multi-media format
        return {
            role: "user",
            content: message.content.some((item) => item.type !== "text")
                ? message.content.map((part) => {
                    if (part.type === "imageUrl") {
                        return {
                            type: "image_url",
                            image_url: {
                                url: part.imageUrl.url,
                                detail: "auto",
                            },
                        };
                    }
                    return part;
                })
                : message.content
                    .map((item) => item.text)
                    .join("") || " ",
        };
    }
}
function toChatBody(messages, options, providerFlags) {
    const params = {
        messages: messages
            .map((m, index) => toChatMessage(m, options, messages[index - 1], providerFlags))
            .filter((m) => m !== null),
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stream: options.stream ?? true,
        stop: options.stop,
        prediction: options.prediction,
        tool_choice: options.toolChoice,
    };
    if (options.tools?.length) {
        params.tools = options.tools
            .filter((tool) => !tool.type || tool.type === "function")
            .map((tool) => ({
            type: tool.type,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
                strict: tool.function.strict,
            },
        }));
    }
    return params;
}
function toCompleteBody(prompt, options) {
    return {
        prompt,
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stream: options.stream ?? true,
        stop: options.stop,
    };
}
function toFimBody(prefix, suffix, options) {
    return {
        model: options.model,
        prompt: prefix,
        suffix,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: true,
    };
}
function fromChatResponse(response) {
    const messages = [];
    const message = response.choices[0].message;
    // Check for reasoning content first (similar to fromChatCompletionChunk)
    if (message.reasoning_content || message.reasoning) {
        const thinkingMessage = {
            role: "thinking",
            content: message.reasoning_content || message.reasoning,
        };
        // Preserve reasoning_details if present
        if (message.reasoning_details) {
            thinkingMessage.reasoning_details = message.reasoning_details;
            // Extract signature from reasoning_details if available
            if (message.reasoning_details[0]?.signature) {
                thinkingMessage.signature = message.reasoning_details[0].signature;
            }
        }
        messages.push(thinkingMessage);
    }
    // Then add the assistant message
    const toolCall = message.tool_calls?.[0];
    if (toolCall) {
        messages.push({
            role: "assistant",
            content: "",
            toolCalls: message.tool_calls
                ?.filter((tc) => !tc.type || tc.type === "function")
                .map((tc) => ({
                id: tc.id,
                type: "function",
                function: {
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                },
            })),
        });
    }
    else {
        messages.push({
            role: "assistant",
            content: message.content ?? "",
        });
    }
    return messages;
}
function fromChatCompletionChunk(chunk) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) {
        return {
            role: "assistant",
            content: delta.content,
        };
    }
    else if (delta?.tool_calls) {
        const toolCalls = delta?.tool_calls
            .filter((tool_call) => !tool_call.type || tool_call.type === "function")
            .map((tool_call) => ({
            id: tool_call.id,
            type: "function",
            function: {
                name: tool_call.function?.name,
                arguments: tool_call.function?.arguments,
            },
        }));
        if (toolCalls.length > 0) {
            return {
                role: "assistant",
                content: "",
                toolCalls,
            };
        }
    }
    else if (delta?.reasoning_content ||
        delta?.reasoning ||
        delta?.reasoning_details?.length) {
        const message = {
            role: "thinking",
            content: delta.reasoning_content || delta.reasoning || "",
            signature: delta?.reasoning_details?.[0]?.signature,
            reasoning_details: delta?.reasoning_details,
        };
        return message;
    }
    return undefined;
}
function handleTextDeltaEvent(e) {
    return e.delta ? { role: "assistant", content: e.delta } : undefined;
}
function handleFunctionCallArgsDelta(e) {
    const ev = e;
    const item = ev.item || {};
    const name = item && typeof item.name === "string" ? item.name : undefined;
    const argDelta = typeof ev.delta === "string"
        ? ev.delta
        : (ev.delta?.arguments ?? ev.arguments);
    if (typeof argDelta === "string" && argDelta.length > 0) {
        const call_id = item?.call_id ||
            item?.id ||
            "";
        const toolCalls = [
            {
                id: call_id,
                type: "function",
                function: { name: name || "", arguments: argDelta },
            },
        ];
        const assistant = {
            role: "assistant",
            content: "",
            toolCalls,
        };
        return assistant;
    }
    return undefined;
}
function handleOutputItemAdded(e) {
    const item = e.item;
    if (!item || !item.type)
        return undefined;
    if (item.type === "reasoning") {
        const details = [];
        if (item.id)
            details.push({ type: "reasoning_id", id: item.id });
        if (typeof item.encrypted_content === "string" && item.encrypted_content) {
            details.push({
                type: "encrypted_content",
                encrypted_content: item.encrypted_content,
            });
        }
        if (Array.isArray(item.summary)) {
            for (const part of item.summary) {
                if (part?.type === "summary_text" && typeof part.text === "string") {
                    details.push({ type: "summary_text", text: part.text });
                }
            }
        }
        const thinking = {
            role: "thinking",
            content: "",
            reasoning_details: details,
            metadata: {
                reasoningId: item.id,
                encrypted_content: item.encrypted_content,
            },
        };
        return thinking;
    }
    if (item.type === "message" && typeof item.id === "string") {
        return {
            role: "assistant",
            content: "",
            metadata: { responsesOutputItemId: item.id },
        };
    }
    if (item.type === "function_call" && typeof item.id === "string") {
        const name = item.name;
        const args = typeof item.arguments === "string" ? item.arguments : "";
        const call_id = item.call_id;
        const toolCalls = name
            ? [
                {
                    id: call_id || item.id,
                    type: "function",
                    function: { name, arguments: args },
                },
            ]
            : [];
        const assistant = {
            role: "assistant",
            content: "",
            toolCalls,
            metadata: { responsesOutputItemId: item.id },
        };
        return assistant;
    }
    return undefined;
}
function handleReasoningSummaryDelta(e) {
    const details = [
        { type: "summary_text", text: e.delta },
    ];
    if (e.item_id)
        details.push({ type: "reasoning_id", id: e.item_id });
    const thinking = {
        role: "thinking",
        content: e.delta,
        reasoning_details: details,
    };
    return thinking;
}
function handleReasoningSummaryDone(e) {
    const details = [];
    if (e.text)
        details.push({ type: "summary_text", text: e.text });
    if (e.item_id)
        details.push({ type: "reasoning_id", id: e.item_id });
    const thinking = {
        role: "thinking",
        content: e.text,
        reasoning_details: details,
    };
    return thinking;
}
function handleReasoningTextDelta(e) {
    const details = [
        { type: "reasoning_text", text: e.delta },
    ];
    if (e.item_id)
        details.push({ type: "reasoning_id", id: e.item_id });
    const thinking = {
        role: "thinking",
        content: e.delta,
        reasoning_details: details,
    };
    return thinking;
}
function handleReasoningTextDone(e) {
    const details = [];
    if (e.text)
        details.push({ type: "reasoning_text", text: e.text });
    if (e.item_id)
        details.push({ type: "reasoning_id", id: e.item_id });
    const thinking = {
        role: "thinking",
        content: e.text,
        reasoning_details: details,
    };
    return thinking;
}
function handleResponsesStreamEvent(e) {
    const t = e.type;
    if (t === "response.output_text.delta") {
        return handleTextDeltaEvent(e);
    }
    if (t === "response.output_text.done") {
        return undefined; // avoid duplicate final text
    }
    if (t === "response.function_call_arguments.delta") {
        return handleFunctionCallArgsDelta(e);
    }
    if (t === "response.function_call_arguments.done") {
        return undefined;
    }
    if (t === "response.output_item.added") {
        return handleOutputItemAdded(e);
    }
    if (t === "response.reasoning_summary_text.delta") {
        return handleReasoningSummaryDelta(e);
    }
    if (t === "response.reasoning_summary_text.done") {
        return handleReasoningSummaryDone(e);
    }
    if (t === "response.reasoning_text.delta") {
        return handleReasoningTextDelta(e);
    }
    if (t === "response.reasoning_text.done") {
        return handleReasoningTextDone(e);
    }
    return undefined;
}
function handleResponsesFinal(resp) {
    // Prefer structured output items when present
    if (Array.isArray(resp.output) && resp.output.length > 0) {
        const result = [];
        for (const raw of resp.output) {
            const item = raw;
            if (!item || typeof item !== "object")
                continue;
            if (item.type === "reasoning") {
                const details = [];
                if (typeof item.id === "string") {
                    details.push({ type: "reasoning_id", id: item.id });
                }
                if (Array.isArray(item.summary)) {
                    for (const s of item.summary) {
                        if (s?.type === "summary_text" && typeof s.text === "string") {
                            details.push({ type: "summary_text", text: s.text });
                        }
                    }
                }
                if (Array.isArray(item.content)) {
                    for (const c of item.content) {
                        if (c?.type === "reasoning_text" && typeof c.text === "string") {
                            details.push({ type: "reasoning_text", text: c.text });
                        }
                    }
                }
                if (typeof item.encrypted_content === "string" &&
                    item.encrypted_content) {
                    details.push({
                        type: "encrypted_content",
                        encrypted_content: item.encrypted_content,
                    });
                }
                const thinking = {
                    role: "thinking",
                    content: "",
                    reasoning_details: details,
                    metadata: {
                        reasoningId: item.id,
                        encrypted_content: item.encrypted_content,
                    },
                };
                result.push(thinking);
                continue;
            }
            if (item.type === "message") {
                let text = "";
                if (Array.isArray(item.content)) {
                    text = item.content
                        .map((c) => (typeof c?.text === "string" ? c.text : ""))
                        .join("");
                }
                else if (typeof item.content === "string") {
                    text = item.content;
                }
                const assistant = {
                    role: "assistant",
                    content: text || "",
                    metadata: typeof item.id === "string"
                        ? { responsesOutputItemId: item.id }
                        : undefined,
                };
                result.push(assistant);
                continue;
            }
            if (item.type === "function_call") {
                const name = item.name;
                const args = typeof item.arguments === "string"
                    ? item.arguments
                    : JSON.stringify(item.arguments ?? "");
                const call_id = item.call_id ||
                    item.id ||
                    "";
                const toolCalls = name
                    ? [
                        {
                            id: call_id,
                            type: "function",
                            function: { name, arguments: args || "" },
                        },
                    ]
                    : [];
                const assistant = {
                    role: "assistant",
                    content: "",
                    toolCalls,
                    metadata: typeof item.id === "string"
                        ? { responsesOutputItemId: item.id }
                        : undefined,
                };
                result.push(assistant);
                continue;
            }
        }
        if (result.length > 0)
            return result;
    }
    // Fallback to output_text when no structured output is present
    if (typeof resp.output_text === "string" && resp.output_text.length > 0) {
        return { role: "assistant", content: resp.output_text };
    }
    return undefined;
}
function fromResponsesChunk(event) {
    if (typeof event.type === "string") {
        return handleResponsesStreamEvent(event);
    }
    return handleResponsesFinal(event);
}
function mergeReasoningDetails(existing, delta) {
    if (!delta)
        return existing;
    if (!existing)
        return delta;
    const result = [...existing];
    for (const deltaItem of delta) {
        // Skip items without a type
        if (!deltaItem.type) {
            continue;
        }
        // Find existing item with the same type
        const existingIndex = result.findIndex((item) => item.type === deltaItem.type);
        if (existingIndex === -1) {
            // No existing item with this type, add new item
            result.push({ ...deltaItem });
        }
        else {
            // Merge with existing item of the same type
            const existingItem = result[existingIndex];
            for (const [key, value] of Object.entries(deltaItem)) {
                if (value === null || value === undefined)
                    continue;
                if (key === "text" || key === "signature" || key === "summary") {
                    // Concatenate text and signature fields
                    existingItem[key] = (existingItem[key] || "") + value;
                }
                else if (key !== "type") {
                    // Don't overwrite type
                    // Overwrite other fields
                    existingItem[key] = value;
                }
            }
        }
    }
    return result;
}
function getTextFromMessageContent(content) {
    if (typeof content === "string")
        return content;
    return content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
}
function toResponseInputContentList(parts) {
    const list = [];
    for (const part of parts) {
        if (part.type === "text") {
            list.push({ type: "input_text", text: part.text });
        }
        else if (part.type === "imageUrl") {
            list.push({
                type: "input_image",
                image_url: part.imageUrl.url,
                detail: "auto",
            });
        }
    }
    return list;
}
function toResponsesInput(messages) {
    const input = [];
    const pushMessage = (role, content) => {
        const normalizedRole = role === "system" ? "developer" : role;
        const easyMsg = {
            role: normalizedRole,
            content,
            type: "message",
        };
        input.push(easyMsg);
    };
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        switch (msg.role) {
            case "system": {
                const content = getTextFromMessageContent(msg.content);
                pushMessage("developer", content || "");
                break;
            }
            case "user": {
                if (typeof msg.content === "string") {
                    pushMessage("user", msg.content);
                }
                else if (Array.isArray(msg.content)) {
                    const parts = toResponseInputContentList(msg.content);
                    pushMessage("user", parts.length ? parts : "");
                }
                break;
            }
            case "assistant": {
                const text = getTextFromMessageContent(msg.content);
                const respId = msg.metadata?.responsesOutputItemId;
                const toolCalls = msg.toolCalls;
                if (respId && Array.isArray(toolCalls) && toolCalls.length > 0) {
                    // Emit full function_call output item
                    const tc = toolCalls[0];
                    const name = tc?.function?.name;
                    const args = tc?.function?.arguments;
                    const call_id = tc?.id;
                    const functionCallItem = {
                        id: respId,
                        type: "function_call",
                        name: name || "",
                        arguments: typeof args === "string" ? args : "{}",
                        call_id: call_id || respId,
                    };
                    input.push(functionCallItem);
                }
                else if (respId) {
                    // Emit full assistant output message item
                    const outputMessageItem = {
                        id: respId,
                        role: "assistant",
                        type: "message",
                        status: "completed",
                        content: [
                            {
                                type: "output_text",
                                text: text || "",
                                annotations: [],
                            },
                        ],
                    };
                    input.push(outputMessageItem);
                }
                else {
                    // Fallback to EasyInput assistant message
                    pushMessage("assistant", text || "");
                }
                break;
            }
            case "tool": {
                const call_id = msg.toolCallId;
                const output = typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content);
                const functionCallOutput = {
                    type: "function_call_output",
                    call_id,
                    output,
                };
                input.push(functionCallOutput);
                break;
            }
            case "thinking": {
                const details = msg.reasoning_details ?? [];
                if (details.length) {
                    let id;
                    let summaryText = "";
                    let encrypted;
                    let reasoningText = "";
                    for (const raw of details) {
                        const d = raw;
                        if (d.type === "reasoning_id" && d.id)
                            id = d.id;
                        else if (d.type === "encrypted_content" && d.encrypted_content)
                            encrypted = d.encrypted_content;
                        else if (d.type === "summary_text" && typeof d.text === "string")
                            summaryText += d.text;
                        else if (d.type === "reasoning_text" && typeof d.text === "string")
                            reasoningText += d.text;
                    }
                    if (id) {
                        const reasoningItem = {
                            id,
                            type: "reasoning",
                            summary: [],
                        };
                        if (summaryText) {
                            reasoningItem.summary = [
                                { type: "summary_text", text: summaryText },
                            ];
                        }
                        if (reasoningText) {
                            reasoningItem.content = [
                                { type: "reasoning_text", text: reasoningText },
                            ];
                        }
                        if (encrypted) {
                            reasoningItem.encrypted_content = encrypted;
                        }
                        input.push(reasoningItem);
                    }
                }
                break;
            }
        }
    }
    return input;
}
//# sourceMappingURL=openaiTypeConverters.js.map