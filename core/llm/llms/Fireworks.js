"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Fireworks extends OpenAI_js_1.default {
    _convertModelName(model) {
        return Fireworks.modelConversion[model] ?? model;
    }
}
Fireworks.providerName = "fireworks";
Fireworks.defaultOptions = {
    apiBase: "https://api.fireworks.ai/inference/v1/",
};
Fireworks.modelConversion = {
    "starcoder-7b": "accounts/fireworks/models/starcoder-7b",
};
exports.default = Fireworks;
//# sourceMappingURL=Fireworks.js.map