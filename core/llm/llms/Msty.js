"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Ollama_js_1 = __importDefault(require("./Ollama.js"));
class Msty extends Ollama_js_1.default {
}
Msty.providerName = "msty";
Msty.defaultOptions = {
    apiBase: "http://localhost:10000",
    model: "codellama-7b",
};
exports.default = Msty;
//# sourceMappingURL=Msty.js.map