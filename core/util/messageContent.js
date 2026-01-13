"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripImages = stripImages;
exports.renderChatMessage = renderChatMessage;
exports.renderContextItems = renderContextItems;
exports.renderContextItemsWithStatus = renderContextItemsWithStatus;
exports.normalizeToMessageParts = normalizeToMessageParts;
function stripImages(messageContent) {
    if (typeof messageContent === "string") {
        return messageContent;
    }
    return messageContent
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
}
function renderChatMessage(message) {
    switch (message?.role) {
        case "user":
        case "assistant":
        case "thinking":
        case "system":
            return stripImages(message.content);
        case "tool":
            return message.content;
        default:
            return "";
    }
}
function renderContextItems(contextItems) {
    return contextItems.map((item) => item.content).join("\n\n");
}
function renderContextItemsWithStatus(contextItems) {
    return contextItems
        .map((item) => {
        let result = item.content;
        // If this item has a status, append it directly after the content
        if (item.status) {
            result += `\n[Status: ${item.status}]`;
        }
        return result;
    })
        .join("\n\n");
}
function normalizeToMessageParts(message) {
    switch (message.role) {
        case "user":
        case "assistant":
        case "thinking":
        case "system":
            return Array.isArray(message.content)
                ? message.content
                : [{ type: "text", text: message.content }];
        case "tool":
            return [{ type: "text", text: message.content }];
    }
}
//# sourceMappingURL=messageContent.js.map