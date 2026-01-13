"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const edit_js_1 = require("../templates/edit.js");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class TARS extends OpenAI_js_1.default {
}
TARS.providerName = "tars";
TARS.defaultOptions = {
    apiBase: "https://api.router.tetrate.ai/v1",
    model: "gpt-5-mini",
    promptTemplates: {
        edit: edit_js_1.osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
};
exports.default = TARS;
//# sourceMappingURL=TARS.js.map