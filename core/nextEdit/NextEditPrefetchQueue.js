"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrefetchQueue = void 0;
const NextEditProvider_1 = require("./NextEditProvider");
/**
 * Keeps a queue of the broken down diffs from a changed editable range, as determined in core/nextEdit/diff.ts
 */
/**
 * This is where the chain is stored. Think of it as a regular queue, but being a singleton because we need one source of truth for the chain.
 * I originally intended this to be a separate data structure to handle prefetching next edit outcomes from the model in the background.
 * Due to subpar results, lack of satisfactory next edit location suggestion algorithms and token cost/latency issues, I scratched the idea.
 */
class PrefetchQueue {
    constructor(prefetchLimit = 3) {
        this.unprocessedQueue = [];
        this.processedQueue = [];
        this.usingFullFileDiff = true;
        this.prefetchLimit = prefetchLimit;
        this.abortController = new AbortController();
    }
    static getInstance(prefetchLimit = 3) {
        if (!PrefetchQueue.instance) {
            PrefetchQueue.instance = new PrefetchQueue(prefetchLimit);
        }
        return PrefetchQueue.instance;
    }
    initialize(usingFullFileDiff) {
        this.usingFullFileDiff = usingFullFileDiff;
    }
    // Queue management methods
    enqueueUnprocessed(location) {
        this.unprocessedQueue.push(location);
    }
    dequeueUnprocessed() {
        return this.unprocessedQueue.shift();
    }
    enqueueProcessed(item) {
        this.processedQueue.push(item);
    }
    dequeueProcessed() {
        return this.processedQueue.shift();
    }
    // Process items from unprocessed queue
    async process(ctx) {
        while (this.unprocessedQueue.length > 0 &&
            this.processedQueue.length < this.prefetchLimit &&
            !this.abortController.signal.aborted) {
            const location = this.dequeueUnprocessed();
            console.log("processing:");
            console.log(location?.range.start.line + " to " + location?.range.end.line);
            if (!location)
                break;
            try {
                const outcome = await NextEditProvider_1.NextEditProvider.getInstance().provideInlineCompletionItemsWithChain(ctx, location, this.abortController.signal, this.usingFullFileDiff);
                if (!outcome) {
                    console.log("outcome is undefined");
                    continue;
                }
                this.enqueueProcessed({
                    location,
                    outcome,
                });
                console.log("the length of processed queue after processing is:", this.processedQueue.length);
            }
            catch (error) {
                if (!this.abortController.signal.aborted) {
                    // Handle error
                    console.error("Error processing item:", error);
                }
                // If aborted, we just stop processing
                break;
            }
        }
    }
    // Abort all operations
    abort() {
        this.abortController.abort();
        this.clear();
        // Create a new AbortController for future operations
        this.abortController = new AbortController();
    }
    // Clear all queues
    clear() {
        this.unprocessedQueue = [];
        this.processedQueue = [];
    }
    // Additional helper methods
    get unprocessedCount() {
        return this.unprocessedQueue.length;
    }
    get processedCount() {
        return this.processedQueue.length;
    }
    peekProcessed() {
        return this.processedQueue[0];
    }
    peekThreeProcessed() {
        const count = Math.min(3, this.processedQueue.length);
        const firstThree = this.processedQueue.slice(0, count);
        firstThree.forEach((item, index) => {
            console.debug(`Item ${index + 1}: ${item.location.range.start.line} to ${item.location.range.end.line}`);
        });
    }
    setPreetchLimit(limit) {
        this.prefetchLimit = limit;
    }
}
exports.PrefetchQueue = PrefetchQueue;
PrefetchQueue.instance = null;
//# sourceMappingURL=NextEditPrefetchQueue.js.map