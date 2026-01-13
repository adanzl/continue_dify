"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_1 = __importDefault(require("./OpenAI"));
class Kindo extends OpenAI_1.default {
}
Kindo.providerName = "kindo";
Kindo.defaultOptions = {
    apiBase: "https://llm.kindo.ai/v1/",
    requestOptions: {
        headers: {
            "kindo-token-transaction-type": "CONTINUE",
        },
    },
};
exports.default = Kindo;
//# sourceMappingURL=Kindo.js.map