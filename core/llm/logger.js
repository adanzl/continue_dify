"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMInteractionLog = exports.LLMLogger = void 0;
class LLMLogger {
    constructor() {
        this.nextId = 0;
        this.logItemListeners = [];
    }
    createInteractionLog() {
        return new LLMInteractionLog(this, (this.nextId++).toString());
    }
    onLogItem(listener) {
        this.logItemListeners.push(listener);
    }
    _logItem(item) {
        for (const listener of this.logItemListeners) {
            listener(item);
        }
    }
}
exports.LLMLogger = LLMLogger;
class LLMInteractionLog {
    constructor(logger, interactionId) {
        this.logger = logger;
        this.interactionId = interactionId;
    }
    logItem(item) {
        this.logger._logItem({
            ...item,
            interactionId: this.interactionId,
            timestamp: Date.now(),
        });
    }
}
exports.LLMInteractionLog = LLMInteractionLog;
//# sourceMappingURL=logger.js.map