"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InProcessMessenger = void 0;
const uuid_1 = require("uuid");
const Logger_js_1 = require("../../util/Logger.js");
class InProcessMessenger {
    constructor() {
        // Listeners for the entity that owns this messenger (right now, always Core)
        this.myTypeListeners = new Map();
        // Listeners defined by the other side of the protocol (right now, always IDE)
        this.externalTypeListeners = new Map();
        this._onErrorHandlers = [];
    }
    onError(handler) {
        this._onErrorHandlers.push(handler);
    }
    invoke(messageType, data, messageId) {
        const listener = this.myTypeListeners.get(messageType);
        if (!listener) {
            return;
        }
        const msg = {
            messageType: messageType,
            data,
            messageId: messageId ?? (0, uuid_1.v4)(),
        };
        try {
            return listener(msg);
        }
        catch (error) {
            // Capture message handling errors to Sentry
            Logger_js_1.Logger.error(error, {
                messageType: String(messageType),
                messageId: msg.messageId,
            });
            // Re-throw the original error
            throw error;
        }
    }
    send(messageType, message, _messageId) {
        const messageId = _messageId ?? (0, uuid_1.v4)();
        const data = {
            messageType: messageType,
            data: message,
            messageId,
        };
        this.externalTypeListeners.get(messageType)?.(data);
        return messageId;
    }
    on(messageType, handler) {
        this.myTypeListeners.set(messageType, handler);
    }
    async request(messageType, data) {
        const messageId = (0, uuid_1.v4)();
        const listener = this.externalTypeListeners.get(messageType);
        if (!listener) {
            throw new Error(`No handler for message type "${String(messageType)}"`);
        }
        try {
            const response = await listener({
                messageType: messageType,
                data,
                messageId,
            });
            return response;
        }
        catch (error) {
            // Capture message handling errors to Sentry
            Logger_js_1.Logger.error(error, {
                messageType: String(messageType),
                messageId,
            });
            // Re-throw the original error
            throw error;
        }
    }
    externalOn(messageType, handler) {
        this.externalTypeListeners.set(messageType, handler);
    }
    externalRequest(messageType, data, _messageId) {
        const messageId = _messageId ?? (0, uuid_1.v4)();
        const listener = this.myTypeListeners.get(messageType);
        if (!listener) {
            throw new Error(`No handler for message type "${String(messageType)}"`);
        }
        try {
            const response = listener({
                messageType: messageType,
                data,
                messageId,
            });
            return Promise.resolve(response);
        }
        catch (error) {
            // Capture message handling errors to Sentry
            Logger_js_1.Logger.error(error, {
                messageType: String(messageType),
                messageId,
            });
            // Re-throw the original error
            throw error;
        }
    }
}
exports.InProcessMessenger = InProcessMessenger;
//# sourceMappingURL=index.js.map