"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePromptFile = parsePromptFile;
const YAML = __importStar(require("yaml"));
const uri_1 = require("../util/uri");
function parsePromptFile(path, content) {
    let [preambleRaw, prompt] = content.split("\n---\n");
    if (prompt === undefined) {
        prompt = preambleRaw;
        preambleRaw = "";
    }
    const preamble = YAML.parse(preambleRaw) ?? {};
    const name = preamble.name ?? (0, uri_1.getLastNPathParts)(path, 1).split(".prompt")[0];
    const description = preamble.description ?? name;
    const version = preamble.version ?? 2;
    let systemMessage = undefined;
    if (prompt.includes("<system>")) {
        systemMessage = prompt.split("<system>")[1].split("</system>")[0].trim();
        prompt = prompt.split("</system>")[1].trim();
    }
    return { name, description, systemMessage, prompt, version };
}
//# sourceMappingURL=parsePromptFile.js.map