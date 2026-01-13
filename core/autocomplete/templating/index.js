"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPrompt = renderPrompt;
exports.renderPromptWithTokenLimit = renderPromptWithTokenLimit;
const handlebars_1 = __importDefault(require("handlebars"));
const constants_js_1 = require("../../llm/constants.js");
const countTokens_1 = require("../../llm/countTokens");
const uri_1 = require("../../util/uri");
const AutocompleteTemplate_1 = require("./AutocompleteTemplate");
const filtering_1 = require("./filtering");
const formatting_1 = require("./formatting");
const getStopTokens_1 = require("./getStopTokens");
function getTemplate(helper) {
    if (helper.options.template) {
        return {
            template: helper.options.template,
            completionOptions: {},
            compilePrefixSuffix: undefined,
        };
    }
    return (0, AutocompleteTemplate_1.getTemplateForModel)(helper.modelName);
}
function renderStringTemplate(template, prefix, suffix, lang, filepath, reponame) {
    const filename = (0, uri_1.getUriPathBasename)(filepath);
    const compiledTemplate = handlebars_1.default.compile(template);
    return compiledTemplate({
        prefix,
        suffix,
        filename,
        reponame,
        language: lang.name,
    });
}
/** Consolidates shared setup between renderPrompt and renderPromptWithTokenLimit. */
function preparePromptContext({ snippetPayload, workspaceDirs, helper, }) {
    // Determine base prefix/suffix, accounting for any manually supplied prefix.
    let prefix = helper.input.manuallyPassPrefix || helper.prunedPrefix;
    let suffix = helper.input.manuallyPassPrefix ? "" : helper.prunedSuffix;
    if (suffix === "") {
        suffix = "\n";
    }
    const reponame = (0, uri_1.getUriPathBasename)(workspaceDirs[0] ?? "myproject");
    const { template, compilePrefixSuffix, completionOptions } = getTemplate(helper);
    const snippets = (0, filtering_1.getSnippets)(helper, snippetPayload);
    return {
        prefix,
        suffix,
        reponame,
        template,
        compilePrefixSuffix,
        completionOptions,
        snippets,
    };
}
function renderPrompt({ snippetPayload, workspaceDirs, helper, }) {
    const { prefix, suffix, reponame, template, compilePrefixSuffix, completionOptions, snippets, } = preparePromptContext({ snippetPayload, workspaceDirs, helper });
    // Delegate prompt construction to buildPrompt to avoid duplication.
    const { prompt, prefix: compiledPrefix, suffix: compiledSuffix, } = buildPrompt(template, compilePrefixSuffix, prefix, suffix, helper, snippets, workspaceDirs, reponame);
    const stopTokens = (0, getStopTokens_1.getStopTokens)(completionOptions, helper.lang, helper.modelName);
    return {
        prompt,
        prefix: compiledPrefix,
        suffix: compiledSuffix,
        completionOptions: {
            ...completionOptions,
            stop: stopTokens,
        },
    };
}
/** Builds the final prompt by applying prefix/suffix compilation or snippet formatting, then rendering the template. */
function buildPrompt(template, compilePrefixSuffix, prefix, suffix, helper, snippets, workspaceDirs, reponame) {
    if (compilePrefixSuffix) {
        [prefix, suffix] = compilePrefixSuffix(prefix, suffix, helper.filepath, reponame, snippets, helper.workspaceUris);
    }
    else {
        const formatted = (0, formatting_1.formatSnippets)(helper, snippets, workspaceDirs);
        prefix = [formatted, prefix].join("\n");
    }
    const prompt = typeof template === "string"
        ? renderStringTemplate(template, prefix, suffix, helper.lang, helper.filepath, reponame)
        : template(prefix, suffix, helper.filepath, reponame, helper.lang.name, snippets, helper.workspaceUris);
    return { prompt, prefix, suffix };
}
function pruneLength(llm, prompt) {
    const contextLength = llm.contextLength;
    const reservedTokens = llm.completionOptions.maxTokens ?? constants_js_1.DEFAULT_MAX_TOKENS;
    const safetyBuffer = (0, countTokens_1.getTokenCountingBufferSafety)(contextLength);
    const maxAllowedPromptTokens = contextLength - reservedTokens - safetyBuffer;
    const promptTokenCount = (0, countTokens_1.countTokens)(prompt, llm.model);
    return promptTokenCount - maxAllowedPromptTokens;
}
function renderPromptWithTokenLimit({ snippetPayload, workspaceDirs, helper, llm, }) {
    const { prefix: initialPrefix, suffix: initialSuffix, reponame, template, compilePrefixSuffix, completionOptions, snippets, } = preparePromptContext({ snippetPayload, workspaceDirs, helper });
    // We'll mutate prefix/suffix during pruning, so copy them.
    let prefix = initialPrefix;
    let suffix = initialSuffix;
    let { prompt, prefix: compiledPrefix, suffix: compiledSuffix, } = buildPrompt(template, compilePrefixSuffix, prefix, suffix, helper, snippets, workspaceDirs, reponame);
    // Truncate prefix and suffix if prompt tokens exceed maxAllowedPromptTokens
    if (llm) {
        const prune = pruneLength(llm, prompt);
        if (prune > 0) {
            const tokensToDrop = prune;
            const prefixTokenCount = (0, countTokens_1.countTokens)(prefix, helper.modelName);
            const suffixTokenCount = (0, countTokens_1.countTokens)(suffix, helper.modelName);
            const totalContextTokens = prefixTokenCount + suffixTokenCount;
            if (totalContextTokens > 0) {
                const dropPrefix = Math.ceil(tokensToDrop * (prefixTokenCount / totalContextTokens));
                const dropSuffix = Math.ceil(tokensToDrop - dropPrefix);
                const allowedPrefixTokens = Math.max(0, prefixTokenCount - dropPrefix);
                const allowedSuffixTokens = Math.max(0, suffixTokenCount - dropSuffix);
                prefix = (0, countTokens_1.pruneLinesFromTop)(prefix, allowedPrefixTokens, helper.modelName);
                suffix = (0, countTokens_1.pruneLinesFromBottom)(suffix, allowedSuffixTokens, helper.modelName);
            }
            ({
                prompt,
                prefix: compiledPrefix,
                suffix: compiledSuffix,
            } = buildPrompt(template, compilePrefixSuffix, prefix, suffix, helper, snippets, workspaceDirs, reponame));
        }
    }
    const stopTokens = (0, getStopTokens_1.getStopTokens)(completionOptions, helper.lang, helper.modelName);
    return {
        prompt,
        prefix: compiledPrefix,
        suffix: compiledSuffix,
        completionOptions: {
            ...completionOptions,
            stop: stopTokens,
        },
    };
}
//# sourceMappingURL=index.js.map