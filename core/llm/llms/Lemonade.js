"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Lemonade extends OpenAI_js_1.default {
}
Lemonade.providerName = "lemonade";
Lemonade.defaultOptions = {
    apiBase: "http://localhost:8000/api/v1/",
};
exports.default = Lemonade;
//# sourceMappingURL=Lemonade.js.map