"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autodetectPromptTemplates = autodetectPromptTemplates;
exports.autodetectTemplateFunction = autodetectTemplateFunction;
exports.autodetectTemplateType = autodetectTemplateType;
exports.llmCanGenerateInParallel = llmCanGenerateInParallel;
exports.modelSupportsImages = modelSupportsImages;
exports.modelSupportsNextEdit = modelSupportsNextEdit;
exports.modelSupportsReasoning = modelSupportsReasoning;
const constants_js_1 = require("./constants.js");
const chat_js_1 = require("./templates/chat.js");
const edit_js_1 = require("./templates/edit.js");
const PROVIDER_HANDLES_TEMPLATING = [
    "lmstudio",
    "lemonade",
    "openai",
    "nvidia",
    "ollama",
    "together",
    "novita",
    "msty",
    "anthropic",
    "bedrock",
    "cohere",
    "sagemaker",
    "continue-proxy",
    "mistral",
    "mimo",
    "sambanova",
    "vertexai",
    "watsonx",
    "nebius",
    "relace",
    "openrouter",
    "deepseek",
    "xAI",
    "groq",
    "gemini",
    "docker",
    // TODO add these, change to inverted logic so only the ones that need templating are hardcoded
    // Asksage.ts
    // Azure.ts
    // BedrockImport.ts
    // Cerebras.ts
    // Cloudflare.ts
    // CometAPI.ts
    // CustomLLM.ts
    // DeepInfra.ts
    // Fireworks.ts
    // Flowise.ts
    // FunctionNetwork.ts
    // HuggingFaceInferenceAPI.ts
    // HuggingFaceTEI.ts
    // HuggingFaceTGI.ts
    // Inception.ts
    // Kindo.ts
    // LlamaCpp.ts
    // LlamaStack.ts
    // Llamafile.ts
    // Mock.ts
    // Moonshot.ts
    // NCompass.ts
    // OVHcloud.ts
    // Replicate.ts
    // Scaleway.ts
    // SiliconFlow.ts
    // TARS.ts
    // Test.ts
    // TextGenWebUI.ts
    // TransformersJsEmbeddingsProvider.ts
    // Venice.ts
    // Vllm.ts
    // Voyage.ts
    // etc
];
const PROVIDER_SUPPORTS_IMAGES = [
    "openai",
    "ollama",
    "lemonade",
    "cohere",
    "gemini",
    "msty",
    "anthropic",
    "bedrock",
    "sagemaker",
    "continue-proxy",
    "openrouter",
    "venice",
    "sambanova",
    "vertexai",
    "azure",
    "scaleway",
    "nebius",
    "ovhcloud",
    "watsonx",
];
const MODEL_SUPPORTS_IMAGES = [
    /llava/,
    /gpt-4-turbo/,
    /gpt-4o/,
    /gpt-4o-mini/,
    /claude-3/,
    /gemini-ultra/,
    /gemini-1\.5-pro/,
    /gemini-1\.5-flash/,
    /sonnet/,
    /opus/,
    /haiku/,
    /pixtral/,
    /llama-?3\.2/,
    /llama-?4/, // might use something like /llama-?(?:[4-9](?:\.\d+)?|\d{2,}(?:\.\d+)?)/ for forward compat, if needed
    /\bgemma-?3(?!n)/, // gemma3 supports vision, but gemma3n doesn't!
    /\b(pali|med)gemma/,
    /qwen(.*)vl/,
    /mistral-small/,
    /mistral-medium/,
];
function modelSupportsImages(provider, model, title, capabilities) {
    if (capabilities?.uploadImage !== undefined) {
        return capabilities.uploadImage;
    }
    if (!PROVIDER_SUPPORTS_IMAGES.includes(provider)) {
        return false;
    }
    const lowerModel = model.toLowerCase();
    const lowerTitle = title?.toLowerCase() ?? "";
    if (lowerModel.includes("vision") ||
        lowerTitle.includes("vision") ||
        MODEL_SUPPORTS_IMAGES.some((modelrx) => modelrx.test(lowerModel) || modelrx.test(lowerTitle))) {
        return true;
    }
    return false;
}
function modelSupportsReasoning(model) {
    if (!model) {
        return false;
    }
    if (model.completionOptions?.reasoning !== undefined) {
        // Reasoning support is forced at the config level. Model might not necessarily support it though!
        return model.completionOptions.reasoning;
    }
    // Seems our current way of disabling reasoning is not working for grok code so results in useless lightbulb
    // if (model.model.includes("grok-code")) {
    //   return true;
    // }
    // do not turn reasoning on by default for claude 3 models
    if (model.model.includes("claude") &&
        !model.model.includes("-3-") &&
        !model.model.includes("-3.5-")) {
        return true;
    }
    if (model.model.includes("command-a-reasoning")) {
        return true;
    }
    if (model.model.includes("deepseek-r")) {
        return true;
    }
    return false;
}
const PARALLEL_PROVIDERS = [
    "anthropic",
    "bedrock",
    "cohere",
    "sagemaker",
    "deepinfra",
    "gemini",
    "huggingface-inference-api",
    "huggingface-tgi",
    "mistral",
    "moonshot",
    "replicate",
    "together",
    "novita",
    "sambanova",
    "ovhcloud",
    "nebius",
    "vertexai",
    "function-network",
    "scaleway",
];
function llmCanGenerateInParallel(provider, model) {
    if (provider === "openai") {
        return model.includes("gpt");
    }
    return PARALLEL_PROVIDERS.includes(provider);
}
function isProviderHandlesTemplatingOrNoTemplateTypeRequired(modelName) {
    return (modelName.includes("gpt") ||
        modelName.includes("command") ||
        modelName.includes("aya") ||
        modelName.includes("chat-bison") ||
        modelName.includes("pplx") ||
        modelName.includes("gemini") ||
        modelName.includes("grok") ||
        modelName.includes("moonshot") ||
        modelName.includes("kimi") ||
        modelName.includes("mercury") ||
        /^o\d/.test(modelName));
}
// NOTE: When updating this list,
// update core/nextEdit/templating/NextEditPromptEngine.ts as well.
const MODEL_SUPPORTS_NEXT_EDIT = [
    constants_js_1.NEXT_EDIT_MODELS.MERCURY_CODER,
    constants_js_1.NEXT_EDIT_MODELS.INSTINCT,
];
function modelSupportsNextEdit(capabilities, model, title) {
    if (capabilities?.nextEdit !== undefined) {
        return capabilities.nextEdit;
    }
    const lower = model.toLowerCase();
    if (MODEL_SUPPORTS_NEXT_EDIT.some((modelName) => lower.includes(modelName) || title?.includes(modelName))) {
        return true;
    }
    return false;
}
function autodetectTemplateType(model) {
    const lower = model.toLowerCase();
    if (lower.includes("codellama") && lower.includes("70b")) {
        return "codellama-70b";
    }
    if (isProviderHandlesTemplatingOrNoTemplateTypeRequired(lower)) {
        return undefined;
    }
    if (lower.includes("llama3") || lower.includes("llama-3")) {
        return "llama3";
    }
    if (lower.includes("llava")) {
        return "llava";
    }
    if (lower.includes("tinyllama")) {
        return "zephyr";
    }
    if (lower.includes("xwin")) {
        return "xwin-coder";
    }
    if (lower.includes("dolphin")) {
        return "chatml";
    }
    if (lower.includes("gemma")) {
        return "gemma";
    }
    if (lower.includes("phi2")) {
        return "phi2";
    }
    if (lower.includes("phind")) {
        return "phind";
    }
    if (lower.includes("llama")) {
        return "llama2";
    }
    if (lower.includes("zephyr")) {
        return "zephyr";
    }
    // Claude requests always sent through Messages API, so formatting not necessary
    if (lower.includes("claude")) {
        return "none";
    }
    // Nova Pro requests always sent through Converse API, so formatting not necessary
    if (lower.includes("nova")) {
        return "none";
    }
    if (lower.includes("codestral")) {
        return "none";
    }
    if (lower.includes("alpaca") || lower.includes("wizard")) {
        return "alpaca";
    }
    if (lower.includes("mistral") || lower.includes("mixtral")) {
        return "llama2";
    }
    if (lower.includes("deepseek")) {
        return "deepseek";
    }
    if (lower.includes("ninja") || lower.includes("openchat")) {
        return "openchat";
    }
    if (lower.includes("neural-chat")) {
        return "neural-chat";
    }
    if (lower.includes("granite")) {
        return "granite";
    }
    return "chatml";
}
function autodetectTemplateFunction(model, provider, explicitTemplate = undefined) {
    if (explicitTemplate === undefined &&
        PROVIDER_HANDLES_TEMPLATING.includes(provider)) {
        return null;
    }
    const templateType = explicitTemplate ?? autodetectTemplateType(model);
    if (templateType) {
        const mapping = {
            llama2: chat_js_1.llama2TemplateMessages,
            alpaca: chat_js_1.templateAlpacaMessages,
            phi2: chat_js_1.phi2TemplateMessages,
            phind: chat_js_1.phindTemplateMessages,
            zephyr: chat_js_1.zephyrTemplateMessages,
            anthropic: chat_js_1.anthropicTemplateMessages,
            chatml: chat_js_1.chatmlTemplateMessages,
            deepseek: chat_js_1.deepseekTemplateMessages,
            openchat: chat_js_1.openchatTemplateMessages,
            "xwin-coder": chat_js_1.xWinCoderTemplateMessages,
            "neural-chat": chat_js_1.neuralChatTemplateMessages,
            llava: chat_js_1.llavaTemplateMessages,
            "codellama-70b": chat_js_1.codeLlama70bTemplateMessages,
            gemma: chat_js_1.gemmaTemplateMessage,
            granite: chat_js_1.graniteTemplateMessages,
            llama3: chat_js_1.llama3TemplateMessages,
            codestral: chat_js_1.codestralTemplateMessages,
            none: null,
        };
        return mapping[templateType];
    }
    return null;
}
const USES_OS_MODELS_EDIT_PROMPT = [
    "alpaca",
    "chatml",
    // "codellama-70b", Doesn't respond well to this prompt
    "deepseek",
    "gemma",
    "llama2",
    "llava",
    "neural-chat",
    "openchat",
    "phi2",
    "phind",
    "xwin-coder",
    "zephyr",
    "llama3",
];
function autodetectPromptTemplates(model, explicitTemplate = undefined) {
    const templateType = explicitTemplate ?? autodetectTemplateType(model);
    const templates = {};
    let editTemplate = null;
    if (templateType && USES_OS_MODELS_EDIT_PROMPT.includes(templateType)) {
        // This is overriding basically everything else
        // Will probably delete the rest later, but for now it's easy to revert
        editTemplate = edit_js_1.osModelsEditPrompt;
    }
    else if (templateType === "phind") {
        editTemplate = edit_js_1.phindEditPrompt;
    }
    else if (templateType === "phi2") {
        editTemplate = edit_js_1.simplifiedEditPrompt;
    }
    else if (templateType === "zephyr") {
        editTemplate = edit_js_1.zephyrEditPrompt;
    }
    else if (templateType === "llama2") {
        if (model.includes("mistral")) {
            editTemplate = edit_js_1.mistralEditPrompt;
        }
        else {
            editTemplate = edit_js_1.osModelsEditPrompt;
        }
    }
    else if (templateType === "alpaca") {
        editTemplate = edit_js_1.alpacaEditPrompt;
    }
    else if (templateType === "deepseek") {
        editTemplate = edit_js_1.deepseekEditPrompt;
    }
    else if (templateType === "openchat") {
        editTemplate = edit_js_1.openchatEditPrompt;
    }
    else if (templateType === "xwin-coder") {
        editTemplate = edit_js_1.xWinCoderEditPrompt;
    }
    else if (templateType === "neural-chat") {
        editTemplate = edit_js_1.neuralChatEditPrompt;
    }
    else if (templateType === "codellama-70b") {
        editTemplate = edit_js_1.codeLlama70bEditPrompt;
    }
    else if (templateType === "anthropic") {
        editTemplate = edit_js_1.claudeEditPrompt;
    }
    else if (templateType === "gemma") {
        editTemplate = edit_js_1.gemmaEditPrompt;
    }
    else if (templateType === "llama3") {
        editTemplate = edit_js_1.llama3EditPrompt;
    }
    else if (templateType === "none") {
        editTemplate = null;
    }
    else if (templateType) {
        editTemplate = edit_js_1.gptEditPrompt;
    }
    else if (model.includes("codestral")) {
        editTemplate = edit_js_1.osModelsEditPrompt;
    }
    if (editTemplate !== null) {
        templates.edit = editTemplate;
    }
    return templates;
}
//# sourceMappingURL=autodetect.js.map