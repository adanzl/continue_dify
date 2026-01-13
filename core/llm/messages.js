"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageHasToolCalls = messageHasToolCalls;
exports.messageIsEmpty = messageIsEmpty;
exports.addSpaceToAnyEmptyMessages = addSpaceToAnyEmptyMessages;
exports.isUserOrToolMsg = isUserOrToolMsg;
exports.isToolMessageForId = isToolMessageForId;
exports.messageHasToolCallId = messageHasToolCallId;
exports.chatMessageIsEmpty = chatMessageIsEmpty;
function messageHasToolCalls(msg) {
    return msg.role === "assistant" && !!msg.toolCalls;
}
function messageIsEmpty(message) {
    if (typeof message.content === "string") {
        return message.content.trim() === "";
    }
    if (Array.isArray(message.content)) {
        return message.content.every((item) => item.type === "text" && item.text?.trim() === "");
    }
    return false;
}
// some providers don't support empty messages
function addSpaceToAnyEmptyMessages(messages) {
    return messages.map((message) => {
        if (messageIsEmpty(message)) {
            message.content = " ";
        }
        return message;
    });
}
function isUserOrToolMsg(msg) {
    if (!msg) {
        return false;
    }
    return msg.role === "user" || msg.role === "tool";
}
function isToolMessageForId(msg, toolCallId) {
    return !!msg && msg.role === "tool" && msg.toolCallId === toolCallId;
}
function messageHasToolCallId(msg, toolCallId) {
    return (!!msg &&
        msg.role === "assistant" &&
        !!msg.toolCalls?.find((call) => call.id === toolCallId));
}
function chatMessageIsEmpty(message) {
    switch (message.role) {
        case "system":
        case "user":
            return (typeof message.content === "string" && message.content.trim() === "");
        case "assistant":
            return (typeof message.content === "string" &&
                message.content.trim() === "" &&
                !message.toolCalls);
        case "thinking":
        case "tool":
            return false;
    }
}
//# sourceMappingURL=messages.js.map