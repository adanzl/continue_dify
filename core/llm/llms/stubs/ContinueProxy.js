"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_yaml_1 = require("@continuedev/config-yaml");
const posthog_js_1 = require("../../../util/posthog.js");
const OpenAI_js_1 = __importDefault(require("../OpenAI.js"));
const constants_js_1 = require("../../constants.js");
class ContinueProxy extends OpenAI_js_1.default {
    set controlPlaneProxyInfo(value) {
        this.apiKey = value.workOsAccessToken;
        if (!this.onPremProxyUrl) {
            this.apiBase = new URL("model-proxy/v1/", value.controlPlaneProxyUrl).toString();
        }
    }
    constructor(options) {
        super(options);
        this.useOpenAIAdapterFor = [];
        this.configEnv = options.env;
        // This it set to `undefined` to handle the case where we are proxying requests to Azure. We pass the correct env vars
        // needed to do this in `extraBodyProperties` below, but if we don't set `apiType` to `undefined`, we end up proxying to
        // `/openai/deployments/` which is invalid since that URL construction happens on the proxy.
        this.apiType = undefined;
        this.actualApiBase = options.apiBase;
        this.apiKeyLocation = options.apiKeyLocation;
        this.envSecretLocations = options.envSecretLocations;
        this.orgScopeId = options.orgScopeId;
        this.onPremProxyUrl = options.onPremProxyUrl;
        if (this.onPremProxyUrl) {
            this.apiBase = new URL("model-proxy/v1/", this.onPremProxyUrl).toString();
        }
    }
    get underlyingProviderName() {
        const { provider } = (0, config_yaml_1.parseProxyModelName)(this.model);
        return provider;
    }
    extraBodyProperties() {
        const continueProperties = {
            apiKeyLocation: this.apiKeyLocation,
            envSecretLocations: this.envSecretLocations,
            apiBase: this.actualApiBase,
            orgScopeId: this.orgScopeId ?? null,
            env: this.configEnv,
        };
        return {
            continueProperties,
        };
    }
    getConfigurationStatus() {
        if (!this.apiKeyLocation && !this.envSecretLocations) {
            return constants_js_1.LLMConfigurationStatuses.VALID;
        }
        if (this.apiKeyLocation) {
            const secretLocation = (0, config_yaml_1.decodeSecretLocation)(this.apiKeyLocation);
            if (secretLocation.secretType === config_yaml_1.SecretType.NotFound) {
                return constants_js_1.LLMConfigurationStatuses.MISSING_API_KEY;
            }
        }
        if (this.envSecretLocations) {
            for (const secretLocation of Object.values(this.envSecretLocations)) {
                const decoded = (0, config_yaml_1.decodeSecretLocation)(secretLocation);
                if (decoded.secretType === config_yaml_1.SecretType.NotFound) {
                    return constants_js_1.LLMConfigurationStatuses.MISSING_ENV_SECRET;
                }
            }
        }
        return constants_js_1.LLMConfigurationStatuses.VALID;
    }
    _getHeaders() {
        const headers = super._getHeaders();
        headers["x-continue-unique-id"] = posthog_js_1.Telemetry.uniqueId;
        headers["user-agent"] = this._getUserAgent();
        return headers;
    }
    _getUserAgent() {
        const ideInfo = posthog_js_1.Telemetry.ideInfo;
        const extensionVersion = ideInfo?.extensionVersion ?? "unknown";
        const ideName = ideInfo?.name ?? "unknown";
        const ideType = ideInfo?.ideType ?? "unknown";
        return `Continue/${extensionVersion} (${ideName}; ${ideType})`;
    }
    supportsCompletions() {
        // This was a hotfix and contains duplicate logic from class-specific completion support methods
        if (this.underlyingProviderName === "vllm") {
            return true;
        }
        // other providers that don't support completions include groq, mistral, nvidia, deepseek, etc.
        // For now disabling all except vllm
        return false;
    }
    supportsFim() {
        const { provider } = (0, config_yaml_1.parseProxyModelName)(this.model);
        if (provider === "vllm") {
            return false;
        }
        return true;
    }
    async rerank(query, chunks) {
        const url = new URL("rerank", this.apiBase);
        const resp = await this.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "user-agent": this._getUserAgent(),
            },
            body: JSON.stringify({
                query,
                documents: chunks.map((chunk) => chunk.content),
                model: this.model,
                ...this.extraBodyProperties(),
            }),
        });
        const data = await resp.json();
        const results = data.data.sort((a, b) => a.index - b.index);
        return results.map((result) => result.relevance_score);
    }
}
ContinueProxy.providerName = "continue-proxy";
ContinueProxy.defaultOptions = {
    useLegacyCompletionsEndpoint: false,
};
exports.default = ContinueProxy;
//# sourceMappingURL=ContinueProxy.js.map