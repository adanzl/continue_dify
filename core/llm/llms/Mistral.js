"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const codestral_js_1 = require("../templates/edit/codestral.js");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Mistral extends OpenAI_js_1.default {
    async autodetectApiKeyType() {
        const mistralResp = await fetch("https://api.mistral.ai/v1/models", {
            method: "GET",
            headers: this._getHeaders(),
        });
        if (mistralResp.status === 401) {
            return "codestral";
        }
        return "mistral";
    }
    constructor(options) {
        super(options);
        if (options.model.includes("codestral") &&
            !options.model.includes("mamba")) {
            this.apiBase = options.apiBase ?? "https://codestral.mistral.ai/v1/";
        }
        if (!this.apiBase?.endsWith("/")) {
            this.apiBase += "/";
        }
        // Unless the user explicitly specifies, we will autodetect the API key type and adjust the API base accordingly
        if (!options.apiBase) {
            this.autodetectApiKeyType()
                .then((keyType) => {
                switch (keyType) {
                    case "codestral":
                        this.apiBase = "https://codestral.mistral.ai/v1/";
                        break;
                    case "mistral":
                        this.apiBase = "https://api.mistral.ai/v1/";
                        break;
                }
                this.openaiAdapter = this.createOpenAiAdapter();
            })
                .catch((err) => { });
        }
    }
    _convertModelName(model) {
        return Mistral.modelConversion[model] ?? model;
    }
    _convertArgs(options, messages) {
        const finalOptions = super._convertArgs(options, messages);
        const lastMessage = finalOptions.messages[finalOptions.messages.length - 1];
        if (lastMessage?.role === "assistant") {
            lastMessage.prefix = true;
        }
        return finalOptions;
    }
    supportsFim() {
        return true;
    }
}
Mistral.providerName = "mistral";
Mistral.defaultOptions = {
    apiBase: "https://api.mistral.ai/v1/",
    model: "codestral-latest",
    promptTemplates: {
        edit: codestral_js_1.codestralEditPrompt,
    },
    maxEmbeddingBatchSize: 128,
};
Mistral.modelConversion = {
    "mistral-7b": "open-mistral-7b",
    "mistral-8x7b": "open-mixtral-8x7b",
};
exports.default = Mistral;
//# sourceMappingURL=Mistral.js.map