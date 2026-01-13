"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercuryCoderProvider = void 0;
const constants_js_1 = require("../../llm/constants.js");
const uri_js_1 = require("../../util/uri.js");
const constants_js_2 = require("../constants.js");
const mercuryCoderNextEdit_js_1 = require("../templating/mercuryCoderNextEdit.js");
const NextEditPromptEngine_js_1 = require("../templating/NextEditPromptEngine.js");
const BaseNextEditProvider_js_1 = require("./BaseNextEditProvider.js");
class MercuryCoderProvider extends BaseNextEditProvider_js_1.BaseNextEditModelProvider {
    constructor() {
        super(constants_js_1.NEXT_EDIT_MODELS.MERCURY_CODER);
        const template = NextEditPromptEngine_js_1.NEXT_EDIT_MODEL_TEMPLATES[constants_js_1.NEXT_EDIT_MODELS.MERCURY_CODER];
        this.templateRenderer = new NextEditPromptEngine_js_1.PromptTemplateRenderer(template.template);
    }
    getSystemPrompt() {
        return constants_js_2.MERCURY_SYSTEM_PROMPT;
    }
    getWindowSize() {
        return { topMargin: 0, bottomMargin: 5 };
    }
    shouldInjectUniqueToken() {
        return true;
    }
    getUniqueToken() {
        return constants_js_2.UNIQUE_TOKEN;
    }
    extractCompletion(message) {
        // Extract the code between the markdown code blocks.
        return message.slice(message.indexOf("```\n") + "```\n".length, message.lastIndexOf("\n```"));
    }
    buildPromptContext(context) {
        return {
            recentlyViewedCodeSnippets: context.snippetPayload.recentlyVisitedRangesSnippets.map((snip) => ({
                filepath: snip.filepath,
                content: snip.content,
            })) ?? [],
            currentFileContent: context.helper.fileContents,
            editableRegionStartLine: context.editableRegionStartLine,
            editableRegionEndLine: context.editableRegionEndLine,
            editDiffHistory: context.diffContext,
            currentFilePath: (0, uri_js_1.getUriPathBasename)(context.helper.filepath),
        };
    }
    async generatePrompts(context) {
        const promptCtx = this.buildPromptContext(context);
        const templateVars = {
            recentlyViewedCodeSnippets: (0, mercuryCoderNextEdit_js_1.recentlyViewedCodeSnippetsBlock)(promptCtx.recentlyViewedCodeSnippets),
            currentFileContent: (0, mercuryCoderNextEdit_js_1.currentFileContentBlock)(promptCtx.currentFileContent, promptCtx.editableRegionStartLine, promptCtx.editableRegionEndLine, context.helper.pos),
            editDiffHistory: (0, mercuryCoderNextEdit_js_1.editHistoryBlock)(promptCtx.editDiffHistory),
            currentFilePath: promptCtx.currentFilePath,
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
            recentlyViewedCodeSnippets: (0, mercuryCoderNextEdit_js_1.recentlyViewedCodeSnippetsBlock)(promptCtx.recentlyViewedCodeSnippets),
            currentFileContent: (0, mercuryCoderNextEdit_js_1.currentFileContentBlock)(promptCtx.currentFileContent, promptCtx.editableRegionStartLine, promptCtx.editableRegionEndLine, context.helper.pos),
            editDiffHistory: (0, mercuryCoderNextEdit_js_1.editHistoryBlock)(promptCtx.editDiffHistory),
            currentFilePath: promptCtx.currentFilePath,
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
exports.MercuryCoderProvider = MercuryCoderProvider;
//# sourceMappingURL=MercuryCoderNextEditProvider.js.map