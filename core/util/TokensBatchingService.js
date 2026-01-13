"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokensBatchingService = void 0;
const posthog_js_1 = require("./posthog.js");
class TokensBatchingService {
    static getInstance() {
        if (!TokensBatchingService.instance) {
            TokensBatchingService.instance = new TokensBatchingService();
        }
        return TokensBatchingService.instance;
    }
    constructor() {
        this.batches = new Map();
        this.flushTimer = null;
        this.BATCH_SIZE_LIMIT = 25;
        this.FLUSH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
        this.startFlushTimer();
    }
    addTokens(model, provider, promptTokens, generatedTokens) {
        const key = `${provider}:${model}`;
        if (!this.batches.has(key)) {
            this.batches.set(key, {
                model,
                provider,
                count: 0,
                totalPromptTokens: 0,
                totalGeneratedTokens: 0,
                lastEventTime: Date.now(),
            });
        }
        const batch = this.batches.get(key);
        batch.count++;
        batch.totalPromptTokens += promptTokens;
        batch.totalGeneratedTokens += generatedTokens;
        batch.lastEventTime = Date.now();
        // Flush if batch is full
        if (batch.count >= this.BATCH_SIZE_LIMIT) {
            this.flushBatch(key, batch);
        }
    }
    flushBatch(key, batch) {
        if (batch.count === 0)
            return;
        void posthog_js_1.Telemetry.capture("tokens_generated_batch", {
            model: batch.model,
            provider: batch.provider,
            eventCount: batch.count,
            totalPromptTokens: batch.totalPromptTokens,
            totalGeneratedTokens: batch.totalGeneratedTokens,
            avgPromptTokens: Math.round(batch.totalPromptTokens / batch.count),
            avgGeneratedTokens: Math.round(batch.totalGeneratedTokens / batch.count),
        }, true);
        this.batches.delete(key);
    }
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flushAllBatches();
        }, this.FLUSH_INTERVAL_MS);
        // Allow the process to exit if this timer is the only thing keeping it alive
        // This prevents test hangs and allows graceful shutdown
        this.flushTimer.unref();
    }
    flushAllBatches() {
        for (const [key, batch] of this.batches.entries()) {
            this.flushBatch(key, batch);
        }
    }
    shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.flushAllBatches();
    }
}
exports.TokensBatchingService = TokensBatchingService;
//# sourceMappingURL=TokensBatchingService.js.map