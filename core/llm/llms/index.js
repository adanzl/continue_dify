"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClasses = void 0;
exports.llmFromDescription = llmFromDescription;
exports.llmFromProviderAndOptions = llmFromProviderAndOptions;
const handlebars_1 = __importDefault(require("handlebars"));
const renderTemplatedString_1 = require("../../util/handlebars/renderTemplatedString");
const Anthropic_1 = __importDefault(require("./Anthropic"));
const Asksage_1 = __importDefault(require("./Asksage"));
const Azure_1 = __importDefault(require("./Azure"));
const Bedrock_1 = __importDefault(require("./Bedrock"));
const BedrockImport_1 = __importDefault(require("./BedrockImport"));
const Cerebras_1 = __importDefault(require("./Cerebras"));
const Cloudflare_1 = __importDefault(require("./Cloudflare"));
const Cohere_1 = __importDefault(require("./Cohere"));
const CometAPI_1 = __importDefault(require("./CometAPI"));
const DeepInfra_1 = __importDefault(require("./DeepInfra"));
const Deepseek_1 = __importDefault(require("./Deepseek"));
const Docker_1 = __importDefault(require("./Docker"));
const Fireworks_1 = __importDefault(require("./Fireworks"));
const Flowise_1 = __importDefault(require("./Flowise"));
const FunctionNetwork_1 = __importDefault(require("./FunctionNetwork"));
const Gemini_1 = __importDefault(require("./Gemini"));
const Groq_1 = __importDefault(require("./Groq"));
const HuggingFaceInferenceAPI_1 = __importDefault(require("./HuggingFaceInferenceAPI"));
const HuggingFaceTEI_1 = __importDefault(require("./HuggingFaceTEI"));
const HuggingFaceTGI_1 = __importDefault(require("./HuggingFaceTGI"));
const Inception_1 = __importDefault(require("./Inception"));
const Kindo_1 = __importDefault(require("./Kindo"));
const LlamaCpp_1 = __importDefault(require("./LlamaCpp"));
const Llamafile_1 = __importDefault(require("./Llamafile"));
const LlamaStack_1 = __importDefault(require("./LlamaStack"));
const Lemonade_1 = __importDefault(require("./Lemonade"));
const LMStudio_1 = __importDefault(require("./LMStudio"));
const Mistral_1 = __importDefault(require("./Mistral"));
const Mimo_1 = __importDefault(require("./Mimo"));
const Mock_1 = __importDefault(require("./Mock"));
const Moonshot_1 = __importDefault(require("./Moonshot"));
const Msty_1 = __importDefault(require("./Msty"));
const NCompass_1 = __importDefault(require("./NCompass"));
const Nebius_1 = __importDefault(require("./Nebius"));
const Novita_1 = __importDefault(require("./Novita"));
const Nvidia_1 = __importDefault(require("./Nvidia"));
const Ollama_1 = __importDefault(require("./Ollama"));
const OpenAI_1 = __importDefault(require("./OpenAI"));
const OpenRouter_1 = __importDefault(require("./OpenRouter"));
const OVHcloud_1 = __importDefault(require("./OVHcloud"));
const Relace_1 = require("./Relace");
const Replicate_1 = __importDefault(require("./Replicate"));
const SageMaker_1 = __importDefault(require("./SageMaker"));
const SambaNova_1 = __importDefault(require("./SambaNova"));
const Scaleway_1 = __importDefault(require("./Scaleway"));
const SiliconFlow_1 = __importDefault(require("./SiliconFlow"));
const ContinueProxy_1 = __importDefault(require("./stubs/ContinueProxy"));
const TARS_1 = __importDefault(require("./TARS"));
const Test_1 = __importDefault(require("./Test"));
const TextGenWebUI_1 = __importDefault(require("./TextGenWebUI"));
const Together_1 = __importDefault(require("./Together"));
const Venice_1 = __importDefault(require("./Venice"));
const VertexAI_1 = __importDefault(require("./VertexAI"));
const Vllm_1 = __importDefault(require("./Vllm"));
const Voyage_1 = __importDefault(require("./Voyage"));
const WatsonX_1 = __importDefault(require("./WatsonX"));
const xAI_1 = __importDefault(require("./xAI"));
exports.LLMClasses = [
    Anthropic_1.default,
    Cohere_1.default,
    CometAPI_1.default,
    FunctionNetwork_1.default,
    Gemini_1.default,
    Llamafile_1.default,
    Moonshot_1.default,
    Ollama_1.default,
    Replicate_1.default,
    TextGenWebUI_1.default,
    Together_1.default,
    Novita_1.default,
    HuggingFaceTGI_1.default,
    HuggingFaceTEI_1.default,
    HuggingFaceInferenceAPI_1.default,
    Kindo_1.default,
    LlamaCpp_1.default,
    OpenAI_1.default,
    OVHcloud_1.default,
    Lemonade_1.default,
    LMStudio_1.default,
    Mistral_1.default,
    Mimo_1.default,
    Bedrock_1.default,
    BedrockImport_1.default,
    SageMaker_1.default,
    DeepInfra_1.default,
    Flowise_1.default,
    Groq_1.default,
    Fireworks_1.default,
    NCompass_1.default,
    ContinueProxy_1.default,
    Cloudflare_1.default,
    Deepseek_1.default,
    Docker_1.default,
    Msty_1.default,
    Azure_1.default,
    WatsonX_1.default,
    OpenRouter_1.default,
    Nvidia_1.default,
    Vllm_1.default,
    SambaNova_1.default,
    Mock_1.default,
    Test_1.default,
    Cerebras_1.default,
    Asksage_1.default,
    Nebius_1.default,
    Venice_1.default,
    VertexAI_1.default,
    xAI_1.default,
    SiliconFlow_1.default,
    Scaleway_1.default,
    Relace_1.Relace,
    Inception_1.default,
    Voyage_1.default,
    LlamaStack_1.default,
    TARS_1.default,
];
async function llmFromDescription(desc, readFile, getUriFromPath, uniqueId, ideSettings, llmLogger, completionOptions) {
    const cls = exports.LLMClasses.find((llm) => llm.providerName === desc.provider);
    if (!cls) {
        return undefined;
    }
    const finalCompletionOptions = {
        ...completionOptions,
        ...desc.completionOptions,
    };
    let baseChatSystemMessage = undefined;
    if (desc.systemMessage !== undefined) {
        // baseChatSystemMessage = DEFAULT_CHAT_SYSTEM_MESSAGE;
        // baseChatSystemMessage += "\n\n";
        baseChatSystemMessage = await (0, renderTemplatedString_1.renderTemplatedString)(handlebars_1.default, desc.systemMessage, {}, [], readFile, getUriFromPath);
    }
    let options = {
        ...desc,
        completionOptions: {
            ...finalCompletionOptions,
            model: (desc.model || cls.defaultOptions?.model) ?? "codellama-7b",
            maxTokens: finalCompletionOptions.maxTokens ??
                cls.defaultOptions?.completionOptions?.maxTokens,
        },
        baseChatSystemMessage,
        basePlanSystemMessage: baseChatSystemMessage,
        baseAgentSystemMessage: baseChatSystemMessage,
        logger: llmLogger,
        uniqueId,
    };
    if (desc.provider === "continue-proxy") {
        options.apiKey = ideSettings.userToken;
        if (ideSettings.remoteConfigServerUrl) {
            options.apiBase = new URL("/proxy/v1", ideSettings.remoteConfigServerUrl).toString();
        }
    }
    return new cls(options);
}
function llmFromProviderAndOptions(providerName, llmOptions) {
    const cls = exports.LLMClasses.find((llm) => llm.providerName === providerName);
    if (!cls) {
        throw new Error(`Unknown LLM provider type "${providerName}"`);
    }
    return new cls(llmOptions);
}
//# sourceMappingURL=index.js.map