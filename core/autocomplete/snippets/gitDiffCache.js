"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitDiffCache = void 0;
exports.getDiffFn = getDiffFn;
exports.getDiffsFromCache = getDiffsFromCache;
class GitDiffCache {
    constructor(getDiffFn, cacheTimeSeconds = 60) {
        this.cachedDiff = undefined;
        this.lastFetchTime = 0;
        this.pendingRequest = null;
        this.getDiffFn = getDiffFn;
        this.cacheTimeMs = cacheTimeSeconds * 1000;
    }
    static getInstance(getDiffFn, cacheTimeSeconds) {
        if (!GitDiffCache.instance) {
            GitDiffCache.instance = new GitDiffCache(getDiffFn, cacheTimeSeconds);
        }
        return GitDiffCache.instance;
    }
    async getDiffPromise() {
        try {
            const diff = await this.getDiffFn();
            this.cachedDiff = diff;
            this.lastFetchTime = Date.now();
            return this.cachedDiff;
        }
        catch (e) {
            console.error("Error fetching git diff:", e);
            return [];
        }
        finally {
            this.pendingRequest = null;
        }
    }
    async get() {
        if (this.cachedDiff !== undefined &&
            Date.now() - this.lastFetchTime < this.cacheTimeMs) {
            return this.cachedDiff;
        }
        // If there's already a request in progress, return that instead of starting a new one
        if (this.pendingRequest) {
            return this.pendingRequest;
        }
        this.pendingRequest = this.getDiffPromise();
        return this.pendingRequest;
    }
    invalidate() {
        this.cachedDiff = undefined;
        this.pendingRequest = null;
    }
}
exports.GitDiffCache = GitDiffCache;
GitDiffCache.instance = null;
// factory to make diff cache more testable
function getDiffFn(ide) {
    return () => ide.getDiff(true);
}
async function getDiffsFromCache(ide) {
    const diffCache = GitDiffCache.getInstance(getDiffFn(ide));
    return await diffCache.get();
}
//# sourceMappingURL=gitDiffCache.js.map