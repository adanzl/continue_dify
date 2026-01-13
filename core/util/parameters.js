"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRIEVAL_PARAMS = exports.DO_NOT_COUNT_REJECTED_BEFORE = exports.COUNT_COMPLETION_REJECTED_AFTER = exports.DEFAULT_AUTOCOMPLETE_OPTS = void 0;
exports.DEFAULT_AUTOCOMPLETE_OPTS = {
    disable: false,
    maxPromptTokens: 1024,
    prefixPercentage: 0.3,
    maxSuffixPercentage: 0.2,
    debounceDelay: 350,
    modelTimeout: 150,
    multilineCompletions: "auto",
    // @deprecated TO BE REMOVED
    slidingWindowPrefixPercentage: 0.75,
    // @deprecated TO BE REMOVED
    slidingWindowSize: 500,
    useCache: true,
    onlyMyCode: true,
    useRecentlyEdited: true,
    useRecentlyOpened: true,
    disableInFiles: undefined,
    useImports: true,
    transform: true,
    showWhateverWeHaveAtXMs: 300,
    // Experimental options: true = enabled, false = disabled, number = enabled w priority
    experimental_includeClipboard: false,
    experimental_includeRecentlyVisitedRanges: true,
    experimental_includeRecentlyEditedRanges: true,
    experimental_includeDiff: true,
    experimental_enableStaticContextualization: false,
};
exports.COUNT_COMPLETION_REJECTED_AFTER = 10000;
exports.DO_NOT_COUNT_REJECTED_BEFORE = 250;
exports.RETRIEVAL_PARAMS = {
    rerankThreshold: 0.3,
    nFinal: 20,
    nRetrieve: 50,
    bm25Threshold: -2.5,
    nResultsToExpandWithEmbeddings: 5,
    nEmbeddingsExpandTo: 5,
};
//# sourceMappingURL=parameters.js.map