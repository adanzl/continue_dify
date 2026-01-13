"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Mimo extends OpenAI_js_1.default {
}
Mimo.providerName = "mimo";
Mimo.defaultOptions = {
    apiBase: "https://api.xiaomimimo.com/v1/",
    model: "mimo-v2-flash",
};
exports.default = Mimo;
//# sourceMappingURL=Mimo.js.map