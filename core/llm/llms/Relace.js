"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relace = void 0;
const constants_1 = require("../constants");
const OpenAI_1 = __importDefault(require("./OpenAI"));
class Relace extends OpenAI_1.default {
    constructor() {
        super(...arguments);
        this.useOpenAIAdapterFor = ["*"];
    }
    supportsPrediction(model) {
        return true;
    }
    getConfigurationStatus() {
        if (!this.apiKey) {
            return constants_1.LLMConfigurationStatuses.MISSING_API_KEY;
        }
        return constants_1.LLMConfigurationStatuses.VALID;
    }
}
exports.Relace = Relace;
Relace.providerName = "relace";
Relace.defaultOptions = {
    apiBase: "https://instantapply.endpoint.relace.run/v1/",
};
//# sourceMappingURL=Relace.js.map