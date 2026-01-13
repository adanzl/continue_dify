"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_ONBOARDING_EMBEDDINGS_TITLE = exports.LOCAL_ONBOARDING_EMBEDDINGS_MODEL = exports.LOCAL_ONBOARDING_CHAT_TITLE = exports.LOCAL_ONBOARDING_CHAT_MODEL = exports.LOCAL_ONBOARDING_FIM_TITLE = exports.LOCAL_ONBOARDING_FIM_MODEL = exports.LOCAL_ONBOARDING_PROVIDER_TITLE = void 0;
exports.setupBestConfig = setupBestConfig;
exports.setupLocalConfig = setupLocalConfig;
exports.setupQuickstartConfig = setupQuickstartConfig;
exports.setupProviderConfig = setupProviderConfig;
exports.LOCAL_ONBOARDING_PROVIDER_TITLE = "Ollama";
exports.LOCAL_ONBOARDING_FIM_MODEL = "qwen2.5-coder:1.5b-base";
exports.LOCAL_ONBOARDING_FIM_TITLE = "Qwen2.5-Coder 1.5B";
exports.LOCAL_ONBOARDING_CHAT_MODEL = "llama3.1:8b";
exports.LOCAL_ONBOARDING_CHAT_TITLE = "Llama 3.1 8B";
exports.LOCAL_ONBOARDING_EMBEDDINGS_MODEL = "nomic-embed-text:latest";
exports.LOCAL_ONBOARDING_EMBEDDINGS_TITLE = "Nomic Embed";
const ANTHROPIC_MODEL_CONFIG = {
    slugs: ["anthropic/claude-3-7-sonnet", "anthropic/claude-4-sonnet"],
    apiKeyInputName: "ANTHROPIC_API_KEY",
};
const OPENAI_MODEL_CONFIG = {
    slugs: ["openai/gpt-4.1", "openai/o3", "openai/gpt-4.1-mini"],
    apiKeyInputName: "OPENAI_API_KEY",
};
// TODO: These need updating on the hub
const GEMINI_MODEL_CONFIG = {
    slugs: ["google/gemini-2.5-pro", "google/gemini-2.0-flash"],
    apiKeyInputName: "GEMINI_API_KEY",
};
/**
 * We set the "best" chat + autocopmlete models by default
 * whenever a user doesn't have a config.json
 */
function setupBestConfig(config) {
    return {
        ...config,
        models: config.models,
    };
}
function setupLocalConfig(config) {
    return {
        ...config,
        models: [
            {
                name: exports.LOCAL_ONBOARDING_CHAT_TITLE,
                provider: "ollama",
                model: exports.LOCAL_ONBOARDING_CHAT_MODEL,
                roles: ["chat", "edit", "apply"],
            },
            {
                name: exports.LOCAL_ONBOARDING_FIM_TITLE,
                provider: "ollama",
                model: exports.LOCAL_ONBOARDING_FIM_MODEL,
                roles: ["autocomplete"],
            },
            {
                name: exports.LOCAL_ONBOARDING_EMBEDDINGS_TITLE,
                provider: "ollama",
                model: exports.LOCAL_ONBOARDING_EMBEDDINGS_MODEL,
                roles: ["embed"],
            },
            ...(config.models ?? []),
        ],
    };
}
function setupQuickstartConfig(config) {
    return config;
}
function setupProviderConfig(config, provider, apiKey) {
    let newModels;
    switch (provider) {
        case "openai":
            newModels = OPENAI_MODEL_CONFIG.slugs.map((slug) => ({
                uses: slug,
                with: {
                    [OPENAI_MODEL_CONFIG.apiKeyInputName]: apiKey,
                },
            }));
            break;
        case "anthropic":
            newModels = ANTHROPIC_MODEL_CONFIG.slugs.map((slug) => ({
                uses: slug,
                with: {
                    [ANTHROPIC_MODEL_CONFIG.apiKeyInputName]: apiKey,
                },
            }));
            break;
        case "gemini":
            newModels = GEMINI_MODEL_CONFIG.slugs.map((slug) => ({
                uses: slug,
                with: {
                    [GEMINI_MODEL_CONFIG.apiKeyInputName]: apiKey,
                },
            }));
            break;
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
    return {
        ...config,
        models: [...(config.models ?? []), ...newModels],
    };
}
//# sourceMappingURL=onboarding.js.map