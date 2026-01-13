"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withExponentialBackoff = exports.RETRY_AFTER_HEADER = void 0;
exports.RETRY_AFTER_HEADER = "Retry-After";
const withExponentialBackoff = async (apiCall, maxTries = 5, initialDelaySeconds = 1) => {
    for (let attempt = 0; attempt < maxTries; attempt++) {
        try {
            const result = await apiCall();
            return result;
        }
        catch (error) {
            if (error.response?.status === 429) {
                const retryAfter = error.response?.headers.get(exports.RETRY_AFTER_HEADER);
                const delay = retryAfter
                    ? parseInt(retryAfter, 10)
                    : initialDelaySeconds * 2 ** attempt;
                console.log(`Hit rate limit. Retrying in ${delay} seconds (attempt ${attempt + 1})`);
                await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            }
            else {
                throw error; // Re-throw other errors
            }
        }
    }
    throw new Error(`Failed to make API call after ${maxTries} retries`);
};
exports.withExponentialBackoff = withExponentialBackoff;
//# sourceMappingURL=withExponentialBackoff.js.map