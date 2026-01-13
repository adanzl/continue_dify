"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenAI_1 = __importDefault(require("./OpenAI"));
class Venice extends OpenAI_1.default {
    _convertArgs(options, messages) {
        const finalOptions = super._convertArgs(options, messages);
        if ("venice_parameters" in options &&
            typeof options.venice_parameters === "object") {
            finalOptions.venice_parameters = { ...options.venice_parameters };
        }
        return finalOptions;
    }
}
Venice.providerName = "venice";
Venice.defaultOptions = {
    apiBase: "https://api.venice.ai/api/v1/",
};
exports.default = Venice;
//# sourceMappingURL=Venice.js.map