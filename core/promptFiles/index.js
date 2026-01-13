"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_PROMPT_CONTEXT_PROVIDERS = exports.PROMPTS_DIR_NAME = exports.RULES_DIR_NAME = exports.DEFAULT_RULES_FOLDER = exports.DEFAULT_PROMPTS_FOLDER_V2 = exports.DEFAULT_PROMPTS_FOLDER_V1 = void 0;
exports.DEFAULT_PROMPTS_FOLDER_V1 = ".prompts";
exports.DEFAULT_PROMPTS_FOLDER_V2 = ".continue/prompts";
exports.DEFAULT_RULES_FOLDER = ".continue/rules";
// Subdirectory names (without .continue/ prefix)
exports.RULES_DIR_NAME = "rules";
exports.PROMPTS_DIR_NAME = "prompts";
exports.SUPPORTED_PROMPT_CONTEXT_PROVIDERS = [
    "file",
    "clipboard",
    "repo-map",
    "currentFile",
    "os",
    "problems",
    "codebase",
    "tree",
    "open",
    "debugger",
    "terminal",
    "diff",
];
//# sourceMappingURL=index.js.map