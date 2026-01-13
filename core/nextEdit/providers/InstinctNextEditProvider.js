"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstinctProvider = void 0;
const constants_js_1 = require("../../llm/constants.js");
const constants_js_2 = require("../constants.js");
const instinct_js_1 = require("../templating/instinct.js");
const NextEditPromptEngine_js_1 = require("../templating/NextEditPromptEngine.js");
const BaseNextEditProvider_js_1 = require("./BaseNextEditProvider.js");
class InstinctProvider extends BaseNextEditProvider_js_1.BaseNextEditModelProvider {
    constructor() {
        super(constants_js_1.NEXT_EDIT_MODELS.INSTINCT);
        const template = NextEditPromptEngine_js_1.NEXT_EDIT_MODEL_TEMPLATES[constants_js_1.NEXT_EDIT_MODELS.INSTINCT];
        this.templateRenderer = new NextEditPromptEngine_js_1.PromptTemplateRenderer(template.template);
    }
    getSystemPrompt() {
        return constants_js_2.INSTINCT_SYSTEM_PROMPT;
    }
    getWindowSize() {
        return { topMargin: 1, bottomMargin: 5 };
    }
    shouldInjectUniqueToken() {
        return false; // Instinct doesn't use unique tokens.
    }
    extractCompletion(message) {
        return message; // Instinct returns the completion directly.
    }
    buildPromptContext(context) {
        // Calculate the window around the cursor position (25 lines above and below).
        const windowStart = Math.max(0, context.helper.pos.line - 25);
        const windowEnd = Math.min(context.helper.fileLines.length - 1, context.helper.pos.line + 25);
        // Ensure editable region boundaries are within the window.
        const adjustedEditableStart = Math.max(windowStart, context.editableRegionStartLine);
        const adjustedEditableEnd = Math.min(windowEnd, context.editableRegionEndLine);
        return {
            contextSnippets: context.autocompleteContext,
            currentFileContent: context.helper.fileContents,
            windowStart,
            windowEnd,
            editableRegionStartLine: adjustedEditableStart,
            editableRegionEndLine: adjustedEditableEnd,
            editDiffHistory: context.diffContext,
            currentFilePath: context.helper.filepath,
            languageShorthand: context.helper.lang.name,
        };
    }
    async generatePrompts(context) {
        const promptCtx = this.buildPromptContext(context);
        const templateVars = {
            contextSnippets: (0, instinct_js_1.contextSnippetsBlock)(promptCtx.contextSnippets),
            currentFileContent: (0, instinct_js_1.currentFileContentBlock)(promptCtx.currentFileContent, promptCtx.windowStart, promptCtx.windowEnd, promptCtx.editableRegionStartLine, promptCtx.editableRegionEndLine, context.helper.pos),
            editDiffHistory: (0, instinct_js_1.editHistoryBlock)(promptCtx.editDiffHistory),
            currentFilePath: promptCtx.currentFilePath,
            languageShorthand: promptCtx.languageShorthand,
        };
        const userPromptContent = this.templateRenderer.render(templateVars);
        return [
            {
                role: "system",
                content: this.getSystemPrompt(),
            },
            {
                role: "user",
                content: userPromptContent,
            },
        ];
    }
    buildPromptMetadata(context) {
        const promptCtx = this.buildPromptContext(context);
        const templateVars = {
            contextSnippets: (0, instinct_js_1.contextSnippetsBlock)(promptCtx.contextSnippets),
            currentFileContent: (0, instinct_js_1.currentFileContentBlock)(promptCtx.currentFileContent, promptCtx.windowStart, promptCtx.windowEnd, promptCtx.editableRegionStartLine, promptCtx.editableRegionEndLine, context.helper.pos),
            editDiffHistory: (0, instinct_js_1.editHistoryBlock)(promptCtx.editDiffHistory),
            currentFilePath: promptCtx.currentFilePath,
            languageShorthand: promptCtx.languageShorthand,
        };
        const userPromptContent = this.templateRenderer.render(templateVars);
        return {
            prompt: {
                role: "user",
                content: userPromptContent,
            },
            userEdits: promptCtx.editDiffHistory.join("\n"),
            userExcerpts: templateVars.currentFileContent,
        };
    }
    calculateEditableRegion(helper, usingFullFileDiff) {
        if (usingFullFileDiff) {
            return this.calculateOptimalEditableRegion(helper, 512, "tokenizer");
        }
        else {
            const { topMargin, bottomMargin } = this.getWindowSize();
            return {
                editableRegionStartLine: Math.max(helper.pos.line - topMargin, 0),
                editableRegionEndLine: Math.min(helper.pos.line + bottomMargin, helper.fileLines.length - 1),
            };
        }
    }
}
exports.InstinctProvider = InstinctProvider;
//# sourceMappingURL=InstinctNextEditProvider.js.map