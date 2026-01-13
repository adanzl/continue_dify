"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutocompleteDebouncer = void 0;
const uuid_1 = require("uuid");
class AutocompleteDebouncer {
    constructor() {
        this.debounceTimeout = undefined;
        this.currentRequestId = undefined;
    }
    async delayAndShouldDebounce(debounceDelay) {
        // Generate a unique ID for this request
        const requestId = (0, uuid_1.v4)();
        this.currentRequestId = requestId;
        // Clear any existing timeout
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        // Create a new promise that resolves after the debounce delay
        return new Promise((resolve) => {
            this.debounceTimeout = setTimeout(() => {
                // When the timeout completes, check if this is still the most recent request
                const shouldDebounce = this.currentRequestId !== requestId;
                // If this is the most recent request, it shouldn't be debounced
                if (!shouldDebounce) {
                    this.currentRequestId = undefined;
                }
                resolve(shouldDebounce);
            }, debounceDelay);
        });
    }
}
exports.AutocompleteDebouncer = AutocompleteDebouncer;
//# sourceMappingURL=AutocompleteDebouncer.js.map