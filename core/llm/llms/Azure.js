"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Azure extends OpenAI_js_1.default {
    supportsPrediction(model) {
        return false;
    }
    constructor(options) {
        super(options);
        this.useOpenAIAdapterFor = [];
        this.deployment = options.deployment ?? options.model;
    }
}
Azure.providerName = "azure";
Azure.defaultOptions = {
    apiVersion: "2024-02-15-preview",
    apiType: "azure-openai",
};
exports.default = Azure;
//# sourceMappingURL=Azure.js.map