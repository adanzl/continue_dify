"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
class Groq extends OpenAI_js_1.default {
    constructor() {
        super(...arguments);
        this.maxStopWords = 4;
    }
    _convertModelName(model) {
        return Groq.modelConversion[model] ?? model;
    }
}
Groq.providerName = "groq";
Groq.defaultOptions = {
    apiBase: "https://api.groq.com/openai/v1/",
};
Groq.modelConversion = {
    "mistral-8x7b": "mixtral-8x7b-32768",
    gemma2: "gemma2-9b-it",
    "llama3-8b": "llama3-8b-8192",
    "llama3-70b": "llama3-70b-8192",
    "llama3.1-8b": "llama-3.1-8b-instant",
    "llama3.2-1b": "llama-3.2-1b-preview",
    "llama3.2-3b": "llama-3.2-3b-preview",
    "llama3.2-11b": "llama-3.2-11b-vision-preview",
    "llama3.2-90b": "llama-3.2-90b-vision-preview",
    "llama3.3-70b": "llama-3.3-70b-versatile",
};
exports.default = Groq;
//# sourceMappingURL=Groq.js.map