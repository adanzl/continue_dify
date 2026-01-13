"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROXY_URL = exports.DEFAULT_REASONING_TOKENS = exports.DEFAULT_PRUNING_LENGTH = exports.DEFAULT_MAX_TOKENS = exports.DEFAULT_MAX_CHUNK_SIZE = exports.DEFAULT_MAX_BATCH_SIZE = exports.DEFAULT_CONTEXT_LENGTH = exports.DEFAULT_ARGS = exports.NEXT_EDIT_MODELS = exports.LLMConfigurationStatuses = void 0;
const DEFAULT_MAX_TOKENS = 4096;
exports.DEFAULT_MAX_TOKENS = DEFAULT_MAX_TOKENS;
const DEFAULT_CONTEXT_LENGTH = 32768;
exports.DEFAULT_CONTEXT_LENGTH = DEFAULT_CONTEXT_LENGTH;
const DEFAULT_TEMPERATURE = 0.5;
const DEFAULT_PRUNING_LENGTH = 128000;
exports.DEFAULT_PRUNING_LENGTH = DEFAULT_PRUNING_LENGTH;
const DEFAULT_REASONING_TOKENS = 2048;
exports.DEFAULT_REASONING_TOKENS = DEFAULT_REASONING_TOKENS;
const DEFAULT_ARGS = {
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
};
exports.DEFAULT_ARGS = DEFAULT_ARGS;
const PROXY_URL = "http://localhost:65433";
exports.PROXY_URL = PROXY_URL;
const DEFAULT_MAX_CHUNK_SIZE = 500; // 512 - buffer for safety (in case of differing tokenizers)
exports.DEFAULT_MAX_CHUNK_SIZE = DEFAULT_MAX_CHUNK_SIZE;
const DEFAULT_MAX_BATCH_SIZE = 64;
exports.DEFAULT_MAX_BATCH_SIZE = DEFAULT_MAX_BATCH_SIZE;
var LLMConfigurationStatuses;
(function (LLMConfigurationStatuses) {
    LLMConfigurationStatuses["VALID"] = "valid";
    LLMConfigurationStatuses["MISSING_API_KEY"] = "missing-api-key";
    LLMConfigurationStatuses["MISSING_ENV_SECRET"] = "missing-env-secret";
})(LLMConfigurationStatuses || (exports.LLMConfigurationStatuses = LLMConfigurationStatuses = {}));
var NEXT_EDIT_MODELS;
(function (NEXT_EDIT_MODELS) {
    NEXT_EDIT_MODELS["MERCURY_CODER"] = "mercury-coder";
    NEXT_EDIT_MODELS["INSTINCT"] = "instinct";
})(NEXT_EDIT_MODELS || (exports.NEXT_EDIT_MODELS = NEXT_EDIT_MODELS = {}));
//# sourceMappingURL=constants.js.map