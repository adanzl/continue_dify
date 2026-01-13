"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopAfterMaxProcessingTime = stopAfterMaxProcessingTime;
async function* stopAfterMaxProcessingTime(stream, maxTimeMs, fullStop) {
    const startTime = Date.now();
    /**
     * Check every 10 chunks to avoid performance overhead.
     */
    const checkInterval = 10;
    let chunkCount = 0;
    let totalCharCount = 0;
    for await (const chunk of stream) {
        yield chunk;
        chunkCount++;
        totalCharCount += chunk.length;
        if (chunkCount % checkInterval === 0) {
            if (Date.now() - startTime > maxTimeMs) {
                fullStop();
                return;
            }
        }
    }
}
//# sourceMappingURL=utils.js.map