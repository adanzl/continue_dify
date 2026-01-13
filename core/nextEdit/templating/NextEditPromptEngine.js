"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplateRenderer = exports.NEXT_EDIT_MODEL_TEMPLATES = void 0;
exports.getTemplateForModel = getTemplateForModel;
const handlebars_1 = __importDefault(require("handlebars"));
const constants_1 = require("../constants");
// Keep the template registry
exports.NEXT_EDIT_MODEL_TEMPLATES = {
    "mercury-coder": {
        template: `${constants_1.MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN}\n{{{recentlyViewedCodeSnippets}}}\n${constants_1.MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE}\n\n${constants_1.MERCURY_CURRENT_FILE_CONTENT_OPEN}\ncurrent_file_path: {{{currentFilePath}}}\n{{{currentFileContent}}}\n${constants_1.MERCURY_CURRENT_FILE_CONTENT_CLOSE}\n\n${constants_1.MERCURY_EDIT_DIFF_HISTORY_OPEN}\n{{{editDiffHistory}}}\n${constants_1.MERCURY_EDIT_DIFF_HISTORY_CLOSE}\n`,
    },
    instinct: {
        template: `${constants_1.INSTINCT_USER_PROMPT_PREFIX}\n\n### Context:\n{{{contextSnippets}}}\n\n### User Edits:\n\n{{{editDiffHistory}}}\n\n### User Excerpt:\n{{{currentFilePath}}}\n\n{{{currentFileContent}}}\`\`\`\n### Response:`,
    },
};
// Export a utility for providers to use
class PromptTemplateRenderer {
    constructor(template) {
        this.compiledTemplate = handlebars_1.default.compile(template);
    }
    render(vars) {
        return this.compiledTemplate(vars);
    }
}
exports.PromptTemplateRenderer = PromptTemplateRenderer;
// Keep for backward compatibility or remove if not needed
function getTemplateForModel(modelName) {
    const template = exports.NEXT_EDIT_MODEL_TEMPLATES[modelName];
    if (!template) {
        throw new Error(`Model ${modelName} is not supported for next edit.`);
    }
    return template.template;
}
//# sourceMappingURL=NextEditPromptEngine.js.map