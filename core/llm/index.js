"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLLM = exports.LLMError = void 0;
exports.isModelInstaller = isModelInstaller;
const fetch_1 = require("@continuedev/fetch");
const llm_info_1 = require("@continuedev/llm-info");
const openai_adapters_1 = require("@continuedev/openai-adapters");
const handlebars_1 = __importDefault(require("handlebars"));
const devdataSqlite_js_1 = require("../data/devdataSqlite.js");
const log_js_1 = require("../data/log.js");
const lemonadeHelper_js_1 = require("../util/lemonadeHelper.js");
const Logger_js_1 = require("../util/Logger.js");
const merge_js_1 = __importDefault(require("../util/merge.js"));
const messageContent_js_1 = require("../util/messageContent.js");
const ollamaHelper_js_1 = require("../util/ollamaHelper.js");
const TokensBatchingService_js_1 = require("../util/TokensBatchingService.js");
const withExponentialBackoff_js_1 = require("../util/withExponentialBackoff.js");
const autodetect_js_1 = require("./autodetect.js");
const constants_js_1 = require("./constants.js");
const countTokens_js_1 = require("./countTokens.js");
const openaiTypeConverters_js_1 = require("./openaiTypeConverters.js");
class LLMError extends Error {
    constructor(message, llm) {
        super(message);
        this.llm = llm;
    }
}
exports.LLMError = LLMError;
function isModelInstaller(provider) {
    return (provider &&
        typeof provider.installModel === "function" &&
        typeof provider.isInstallingModel === "function");
}
class BaseLLM {
    get providerName() {
        return this.constructor.providerName;
    }
    /**
     * This exists because for the continue-proxy, sometimes we want to get the value of the underlying provider that is used on the server
     * For example, the underlying provider should always be sent with dev data
     */
    get underlyingProviderName() {
        return this.providerName;
    }
    supportsFim() {
        return false;
    }
    supportsImages() {
        return (0, autodetect_js_1.modelSupportsImages)(this.providerName, this.model, this.title, this.capabilities);
    }
    supportsCompletions() {
        if (["openai", "azure"].includes(this.providerName)) {
            if (this.apiBase?.includes("api.groq.com") ||
                this.apiBase?.includes("api.mistral.ai") ||
                this.apiBase?.includes(":1337") ||
                this.apiBase?.includes("integrate.api.nvidia.com") ||
                this._llmOptions.useLegacyCompletionsEndpoint?.valueOf() === false) {
                // Jan + Groq + Mistral don't support completions : (
                // Seems to be going out of style...
                return false;
            }
        }
        if (["groq", "mistral", "deepseek"].includes(this.providerName)) {
            return false;
        }
        return true;
    }
    supportsPrefill() {
        return ["ollama", "anthropic", "mistral"].includes(this.providerName);
    }
    constructor(_options) {
        // Provider capabilities (overridable by subclasses)
        this.supportsReasoningField = false;
        this.supportsReasoningDetailsField = false;
        this.useOpenAIAdapterFor = [];
        this._llmOptions = _options;
        this.lastRequestId = undefined;
        // Set default options
        const options = {
            title: this.constructor.providerName,
            ...this.constructor.defaultOptions,
            ..._options,
        };
        this.model = options.model;
        // Use @continuedev/llm-info package to autodetect certain parameters
        const modelSearchString = this.providerName === "continue-proxy"
            ? this.model?.split("/").pop() || this.model
            : this.model;
        const llmInfo = (0, llm_info_1.findLlmInfo)(modelSearchString, this.underlyingProviderName);
        const templateType = options.template ?? (0, autodetect_js_1.autodetectTemplateType)(options.model);
        this.title = options.title;
        this.uniqueId = options.uniqueId ?? "None";
        this.baseAgentSystemMessage = options.baseAgentSystemMessage;
        this.basePlanSystemMessage = options.basePlanSystemMessage;
        this.baseChatSystemMessage = options.baseChatSystemMessage;
        this._contextLength = options.contextLength ?? llmInfo?.contextLength;
        this.maxStopWords = options.maxStopWords ?? this.maxStopWords;
        this.completionOptions = {
            ...options.completionOptions,
            model: options.model || "gpt-4",
            maxTokens: options.completionOptions?.maxTokens ??
                (llmInfo?.maxCompletionTokens
                    ? Math.min(llmInfo.maxCompletionTokens, 
                    // Even if the model has a large maxTokens, we don't want to use that every time,
                    // because it takes away from the context length
                    this.contextLength / 4)
                    : constants_js_1.DEFAULT_MAX_TOKENS),
        };
        this.requestOptions = options.requestOptions;
        this.promptTemplates = {
            ...(0, autodetect_js_1.autodetectPromptTemplates)(options.model, templateType),
            ...options.promptTemplates,
        };
        this.templateMessages =
            options.templateMessages ??
                (0, autodetect_js_1.autodetectTemplateFunction)(options.model, this.providerName, options.template) ??
                undefined;
        this.logger = options.logger;
        this.llmRequestHook = options.llmRequestHook;
        this.apiKey = options.apiKey;
        // continueProperties
        this.apiKeyLocation = options.apiKeyLocation;
        this.envSecretLocations = options.envSecretLocations;
        this.orgScopeId = options.orgScopeId;
        this.apiBase = options.apiBase;
        this.onPremProxyUrl = options.onPremProxyUrl;
        this.aiGatewaySlug = options.aiGatewaySlug;
        this.cacheBehavior = options.cacheBehavior;
        // watsonx deploymentId
        this.deploymentId = options.deploymentId;
        if (this.apiBase && !this.apiBase.endsWith("/")) {
            this.apiBase = `${this.apiBase}/`;
        }
        this.accountId = options.accountId;
        this.capabilities = options.capabilities;
        this.roles = options.roles;
        this.deployment = options.deployment;
        this.apiVersion = options.apiVersion;
        this.apiType = options.apiType;
        this.region = options.region;
        this.projectId = options.projectId;
        this.profile = options.profile;
        this.accessKeyId = options.accessKeyId;
        this.secretAccessKey = options.secretAccessKey;
        this.openaiAdapter = this.createOpenAiAdapter();
        this.maxEmbeddingBatchSize =
            options.maxEmbeddingBatchSize ?? constants_js_1.DEFAULT_MAX_BATCH_SIZE;
        this.maxEmbeddingChunkSize =
            options.maxEmbeddingChunkSize ?? constants_js_1.DEFAULT_MAX_CHUNK_SIZE;
        this.embeddingId = `${this.constructor.name}::${this.model}::${this.maxEmbeddingChunkSize}`;
        this.autocompleteOptions = options.autocompleteOptions;
        this.sourceFile = options.sourceFile;
        this.isFromAutoDetect = options.isFromAutoDetect;
    }
    get contextLength() {
        return this._contextLength ?? constants_js_1.DEFAULT_CONTEXT_LENGTH;
    }
    getConfigurationStatus() {
        return constants_js_1.LLMConfigurationStatuses.VALID;
    }
    createOpenAiAdapter() {
        return (0, openai_adapters_1.constructLlmApi)({
            provider: this.providerName,
            apiKey: this.apiKey ?? "",
            apiBase: this.apiBase,
            requestOptions: this.requestOptions,
            env: this._llmOptions.env,
        });
    }
    listModels() {
        return Promise.resolve([]);
    }
    _templatePromptLikeMessages(prompt) {
        if (!this.templateMessages) {
            return prompt;
        }
        // NOTE system message no longer supported here
        const msgs = [{ role: "user", content: prompt }];
        return this.templateMessages(msgs);
    }
    _logEnd(model, prompt, completion, thinking, interaction, usage, error) {
        let promptTokens = this.countTokens(prompt);
        let generatedTokens = this.countTokens(completion);
        let thinkingTokens = thinking ? this.countTokens(thinking) : 0;
        TokensBatchingService_js_1.TokensBatchingService.getInstance().addTokens(model, this.providerName, promptTokens, generatedTokens);
        void devdataSqlite_js_1.DevDataSqliteDb.logTokensGenerated(model, this.providerName, promptTokens, generatedTokens);
        void log_js_1.DataLogger.getInstance().logDevData({
            name: "tokensGenerated",
            data: {
                model: model,
                provider: this.underlyingProviderName,
                promptTokens: promptTokens,
                generatedTokens: generatedTokens,
            },
        });
        if (typeof error === "undefined") {
            interaction?.logItem({
                kind: "success",
                promptTokens,
                generatedTokens,
                thinkingTokens,
                usage,
            });
            return "success";
        }
        else {
            if (error === "cancel" || error?.name?.includes("AbortError")) {
                interaction?.logItem({
                    kind: "cancel",
                    promptTokens,
                    generatedTokens,
                    thinkingTokens,
                    usage,
                });
                return "cancelled";
            }
            else {
                console.log(error);
                interaction?.logItem({
                    kind: "error",
                    name: error.name,
                    message: error.message,
                    promptTokens,
                    generatedTokens,
                    thinkingTokens,
                    usage,
                });
                return "error";
            }
        }
    }
    async parseError(resp) {
        let text = await resp.text();
        if (resp.status === 404 && !resp.url.includes("/v1")) {
            const parsedError = JSON.parse(text);
            const errorMessageRaw = parsedError?.error ?? parsedError?.message;
            const error = typeof errorMessageRaw === "string"
                ? errorMessageRaw.replace(/"/g, "'")
                : undefined;
            let model = error?.match(/model '(.*)' not found/)?.[1];
            if (model && resp.url.match("127.0.0.1:11434")) {
                text = `The model "${model}" was not found. To download it, run \`ollama run ${model}\`.`;
                return new LLMError(text, this); // No need to add HTTP status details
            }
            else if (text.includes("/api/chat")) {
                text =
                    "The /api/chat endpoint was not found. This may mean that you are using an older version of Ollama that does not support /api/chat. Upgrading to the latest version will solve the issue.";
            }
            else {
                text =
                    "This may mean that you forgot to add '/v1' to the end of your 'apiBase' in config.json.";
            }
        }
        else if (resp.status === 404 && resp.url.includes("api.openai.com")) {
            text =
                "You may need to add pre-paid credits before using the OpenAI API.";
        }
        else if (resp.status === 401 &&
            (resp.url.includes("api.mistral.ai") ||
                resp.url.includes("codestral.mistral.ai"))) {
            if (resp.url.includes("codestral.mistral.ai")) {
                return new Error("You are using a Mistral API key, which is not compatible with the Codestral API. Please either obtain a Codestral API key, or use the Mistral API by setting 'apiBase' to 'https://api.mistral.ai/v1' in config.json.");
            }
            else {
                return new Error("You are using a Codestral API key, which is not compatible with the Mistral API. Please either obtain a Mistral API key, or use the the Codestral API by setting 'apiBase' to 'https://codestral.mistral.ai/v1' in config.json.");
            }
        }
        return new Error(`HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`);
    }
    fetch(url, init) {
        // Custom Node.js fetch
        const customFetch = async (input, init) => {
            try {
                const resp = await (0, fetch_1.fetchwithRequestOptions)(new URL(input), { ...init }, { ...this.requestOptions });
                // Error mapping to be more helpful
                if (!resp.ok) {
                    if (resp.status === 499) {
                        return resp; // client side cancellation
                    }
                    const error = await this.parseError(resp);
                    throw error;
                }
                return resp;
            }
            catch (e) {
                // Capture all fetch errors to Sentry for monitoring
                Logger_js_1.Logger.error(e, {
                    context: "llm_fetch",
                    url: String(input),
                    method: init?.method || "GET",
                    model: this.model,
                    provider: this.providerName,
                });
                // Errors to ignore
                if (e.message.includes("/api/tags")) {
                    throw new Error(`Error fetching tags: ${e.message}`);
                }
                else if (e.message.includes("/api/show")) {
                    throw new Error(`HTTP ${e.response.status} ${e.response.statusText} from ${e.response.url}\n\n${e.response.body}`);
                }
                else {
                    if (e.name !== "AbortError") {
                        // Don't pollute console with abort errors. Check on name instead of instanceof, to avoid importing node-fetch here
                        console.debug(`${e.message}\n\nCode: ${e.code}\nError number: ${e.errno}\nSyscall: ${e.erroredSysCall}\nType: ${e.type}\n\n${e.stack}`);
                    }
                    if (e.code === "ECONNREFUSED" &&
                        e.message.includes("http://127.0.0.1:11434")) {
                        const message = (await (0, ollamaHelper_js_1.isOllamaInstalled)())
                            ? "Unable to connect to local Ollama instance. Ollama may not be running."
                            : "Unable to connect to local Ollama instance. Ollama may not be installed or may not running.";
                        throw new Error(message);
                    }
                    if (e.code === "ECONNREFUSED" &&
                        e.message.includes("http://localhost:8000")) {
                        const isInstalled = await (0, lemonadeHelper_js_1.isLemonadeInstalled)();
                        let message;
                        if (process.platform === "linux") {
                            // On Linux, isLemonadeInstalled checks if it's running (via health endpoint)
                            message =
                                "Unable to connect to local Lemonade instance. Please ensure Lemonade is running. Visit http://lemonade-server.ai for setup instructions.";
                        }
                        else {
                            // On Windows, we can check if it's installed
                            message = isInstalled
                                ? "Unable to connect to local Lemonade instance. Lemonade server may not be running."
                                : "Unable to connect to local Lemonade instance. Lemonade may not be installed or may not be running.";
                        }
                        throw new Error(message);
                    }
                }
                throw e;
            }
        };
        return (0, withExponentialBackoff_js_1.withExponentialBackoff)(() => customFetch(url, init), 5, 0.5);
    }
    _parseCompletionOptions(options) {
        const log = options.log ?? true;
        const raw = options.raw ?? false;
        options.log = undefined;
        const completionOptions = (0, merge_js_1.default)(this.completionOptions, options);
        return { completionOptions, logEnabled: log, raw };
    }
    _formatChatMessages(messages) {
        const msgsCopy = messages ? messages.map((msg) => ({ ...msg })) : [];
        let formatted = "";
        for (const msg of msgsCopy) {
            formatted += this._formatChatMessage(msg);
        }
        return formatted;
    }
    _formatChatMessage(msg) {
        let contentToShow = (0, messageContent_js_1.renderChatMessage)(msg);
        if (msg.role === "assistant" && msg.toolCalls?.length) {
            contentToShow +=
                "\n" +
                    msg.toolCalls
                        ?.map((toolCall) => `${toolCall.function?.name}(${toolCall.function?.arguments})`)
                        .join("\n");
        }
        return `<${msg.role}>\n${contentToShow}\n\n`;
    }
    async *_streamFim(prefix, suffix, signal, options) {
        throw new Error("Not implemented");
    }
    shouldUseOpenAIAdapter(requestType) {
        return (this.useOpenAIAdapterFor.includes(requestType) ||
            this.useOpenAIAdapterFor.includes("*"));
    }
    async *streamFim(prefix, suffix, signal, options = {}) {
        this.lastRequestId = undefined;
        const { completionOptions, logEnabled } = this._parseCompletionOptions(options);
        const interaction = logEnabled
            ? this.logger?.createInteractionLog()
            : undefined;
        let status = "in_progress";
        const fimLog = `Prefix: ${prefix}\nSuffix: ${suffix}`;
        if (logEnabled) {
            interaction?.logItem({
                kind: "startFim",
                prefix,
                suffix,
                options: completionOptions,
                provider: this.providerName,
            });
            if (this.llmRequestHook) {
                this.llmRequestHook(completionOptions.model, fimLog);
            }
        }
        let completion = "";
        try {
            if (this.shouldUseOpenAIAdapter("streamFim") && this.openaiAdapter) {
                const stream = this.openaiAdapter.fimStream((0, openaiTypeConverters_js_1.toFimBody)(prefix, suffix, completionOptions), signal);
                for await (const chunk of stream) {
                    if (!this.lastRequestId && typeof chunk.id === "string") {
                        this.lastRequestId = chunk.id;
                    }
                    const result = (0, openaiTypeConverters_js_1.fromChatCompletionChunk)(chunk);
                    if (result) {
                        const content = (0, messageContent_js_1.renderChatMessage)(result);
                        const formattedContent = this._formatChatMessage(result);
                        interaction?.logItem({
                            kind: "chunk",
                            chunk: formattedContent,
                        });
                        completion += formattedContent;
                        yield content;
                    }
                }
            }
            else {
                for await (const chunk of this._streamFim(prefix, suffix, signal, completionOptions)) {
                    interaction?.logItem({
                        kind: "chunk",
                        chunk,
                    });
                    completion += chunk;
                    yield chunk;
                }
            }
            status = this._logEnd(completionOptions.model, fimLog, completion, undefined, interaction, undefined);
        }
        catch (e) {
            // Capture FIM (Fill-in-the-Middle) completion failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "llm_stream_fim",
                model: completionOptions.model,
                provider: this.providerName,
                useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamFim"),
            });
            status = this._logEnd(completionOptions.model, fimLog, completion, undefined, interaction, undefined, e);
            throw e;
        }
        finally {
            if (status === "in_progress") {
                this._logEnd(completionOptions.model, fimLog, completion, undefined, interaction, undefined, "cancel");
            }
        }
        return {
            prompt: fimLog,
            completion,
            completionOptions,
        };
    }
    async *streamComplete(_prompt, signal, options = {}) {
        this.lastRequestId = undefined;
        const { completionOptions, logEnabled, raw } = this._parseCompletionOptions(options);
        const interaction = logEnabled
            ? this.logger?.createInteractionLog()
            : undefined;
        let status = "in_progress";
        let prompt = (0, countTokens_js_1.pruneRawPromptFromTop)(completionOptions.model, this.contextLength, _prompt, completionOptions.maxTokens ?? constants_js_1.DEFAULT_MAX_TOKENS);
        if (!raw) {
            prompt = this._templatePromptLikeMessages(prompt);
        }
        if (logEnabled) {
            interaction?.logItem({
                kind: "startComplete",
                prompt,
                options: completionOptions,
                provider: this.providerName,
            });
            if (this.llmRequestHook) {
                this.llmRequestHook(completionOptions.model, prompt);
            }
        }
        let completion = "";
        try {
            if (this.shouldUseOpenAIAdapter("streamComplete") && this.openaiAdapter) {
                if (completionOptions.stream === false) {
                    // Stream false
                    const response = await this.openaiAdapter.completionNonStream({ ...(0, openaiTypeConverters_js_1.toCompleteBody)(prompt, completionOptions), stream: false }, signal);
                    this.lastRequestId = response.id ?? this.lastRequestId;
                    completion = response.choices[0]?.text ?? "";
                    yield completion;
                }
                else {
                    // Stream true
                    for await (const chunk of this.openaiAdapter.completionStream({
                        ...(0, openaiTypeConverters_js_1.toCompleteBody)(prompt, completionOptions),
                        stream: true,
                    }, signal)) {
                        if (!this.lastRequestId && typeof chunk.id === "string") {
                            this.lastRequestId = chunk.id;
                        }
                        const content = chunk.choices[0]?.text ?? "";
                        completion += content;
                        interaction?.logItem({
                            kind: "chunk",
                            chunk: content,
                        });
                        yield content;
                    }
                }
            }
            else {
                for await (const chunk of this._streamComplete(prompt, signal, completionOptions)) {
                    completion += chunk;
                    interaction?.logItem({
                        kind: "chunk",
                        chunk,
                    });
                    yield chunk;
                }
            }
            status = this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined);
        }
        catch (e) {
            // Capture streaming completion failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "llm_stream_complete",
                model: completionOptions.model,
                provider: this.providerName,
                useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamComplete"),
                streamEnabled: completionOptions.stream !== false,
            });
            status = this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined, e);
            throw e;
        }
        finally {
            if (status === "in_progress") {
                this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined, "cancel");
            }
        }
        return {
            modelTitle: this.title ?? completionOptions.model,
            modelProvider: this.underlyingProviderName,
            prompt,
            completion,
            completionOptions,
        };
    }
    async complete(_prompt, signal, options = {}) {
        this.lastRequestId = undefined;
        const { completionOptions, logEnabled, raw } = this._parseCompletionOptions(options);
        const interaction = logEnabled
            ? this.logger?.createInteractionLog()
            : undefined;
        let status = "in_progress";
        let prompt = (0, countTokens_js_1.pruneRawPromptFromTop)(completionOptions.model, this.contextLength, _prompt, completionOptions.maxTokens ?? constants_js_1.DEFAULT_MAX_TOKENS);
        if (!raw) {
            prompt = this._templatePromptLikeMessages(prompt);
        }
        if (logEnabled) {
            interaction?.logItem({
                kind: "startComplete",
                prompt: prompt,
                options: completionOptions,
                provider: this.providerName,
            });
            if (this.llmRequestHook) {
                this.llmRequestHook(completionOptions.model, prompt);
            }
        }
        let completion = "";
        try {
            if (this.shouldUseOpenAIAdapter("complete") && this.openaiAdapter) {
                const result = await this.openaiAdapter.completionNonStream({
                    ...(0, openaiTypeConverters_js_1.toCompleteBody)(prompt, completionOptions),
                    stream: false,
                }, signal);
                this.lastRequestId = result.id ?? this.lastRequestId;
                completion = result.choices[0].text;
            }
            else {
                completion = await this._complete(prompt, signal, completionOptions);
            }
            interaction?.logItem({
                kind: "chunk",
                chunk: completion,
            });
            status = this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined);
        }
        catch (e) {
            // Capture completion failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "llm_complete",
                model: completionOptions.model,
                provider: this.providerName,
                useOpenAIAdapter: this.shouldUseOpenAIAdapter("complete"),
            });
            status = this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined, e);
            throw e;
        }
        finally {
            if (status === "in_progress") {
                this._logEnd(completionOptions.model, prompt, completion, undefined, interaction, undefined, "cancel");
            }
        }
        return completion;
    }
    async chat(messages, signal, options = {}) {
        let completion = "";
        for await (const message of this.streamChat(messages, signal, options)) {
            completion += (0, messageContent_js_1.renderChatMessage)(message);
        }
        return { role: "assistant", content: completion };
    }
    compileChatMessages(message, options) {
        let { completionOptions } = this._parseCompletionOptions(options);
        completionOptions = this._modifyCompletionOptions(completionOptions);
        return (0, countTokens_js_1.compileChatMessages)({
            modelName: completionOptions.model,
            msgs: message,
            knownContextLength: this._contextLength,
            maxTokens: completionOptions.maxTokens ?? constants_js_1.DEFAULT_MAX_TOKENS,
            supportsImages: this.supportsImages(),
            tools: options.tools,
        });
    }
    modifyChatBody(body) {
        return body;
    }
    _modifyCompletionOptions(completionOptions) {
        // As of 01/14/25 streaming is currently not available with o1
        // See these threads:
        // - https://github.com/continuedev/continue/issues/3698
        // - https://community.openai.com/t/streaming-support-for-o1-o1-2024-12-17-resulting-in-400-unsupported-value/1085043
        if (completionOptions.model === "o1") {
            completionOptions.stream = false;
        }
        return completionOptions;
    }
    // Update the processChatChunk method:
    processChatChunk(chunk, interaction) {
        const completion = [];
        const thinking = [];
        let usage = null;
        if (chunk.role === "assistant") {
            completion.push(this._formatChatMessage(chunk));
        }
        else if (chunk.role === "thinking" && typeof chunk.content === "string") {
            thinking.push(chunk.content);
        }
        interaction?.logItem({
            kind: "message",
            message: chunk,
        });
        if (chunk.role === "assistant" && chunk.usage) {
            usage = chunk.usage;
        }
        return {
            completion,
            thinking,
            usage,
            chunk,
        };
    }
    canUseOpenAIResponses(options) {
        return (this.providerName === "openai" &&
            typeof this._streamResponses === "function" &&
            this.isOSeriesOrGpt5Model(options.model));
    }
    async *openAIAdapterStream(body, signal, onCitations) {
        const stream = this.openaiAdapter.chatCompletionStream({ ...body, stream: true }, signal);
        for await (const chunk of stream) {
            if (!this.lastRequestId && typeof chunk.id === "string") {
                this.lastRequestId = chunk.id;
            }
            const chatChunk = (0, openaiTypeConverters_js_1.fromChatCompletionChunk)(chunk);
            if (chatChunk) {
                yield chatChunk;
            }
            if (chunk.citations && Array.isArray(chunk.citations)) {
                onCitations(chunk.citations);
            }
        }
    }
    async *openAIAdapterNonStream(body, signal) {
        const response = await this.openaiAdapter.chatCompletionNonStream({ ...body, stream: false }, signal);
        this.lastRequestId = response.id ?? this.lastRequestId;
        const messages = (0, openaiTypeConverters_js_1.fromChatResponse)(response);
        for (const msg of messages) {
            yield msg;
        }
    }
    async *responsesStream(messages, signal, options) {
        const g = this._streamResponses(messages, signal, options);
        for await (const m of g) {
            yield m;
        }
    }
    async *responsesNonStream(messages, signal, options) {
        const msg = await this._responses(messages, signal, options);
        yield msg;
    }
    // Update the streamChat method:
    async *streamChat(_messages, signal, options = {}, messageOptions) {
        this.lastRequestId = undefined;
        let { completionOptions, logEnabled } = this._parseCompletionOptions(options);
        const interaction = logEnabled
            ? this.logger?.createInteractionLog()
            : undefined;
        let status = "in_progress";
        completionOptions = this._modifyCompletionOptions(completionOptions);
        let messages = _messages;
        // If not precompiled, compile the chat messages
        if (!messageOptions?.precompiled) {
            const { compiledChatMessages } = (0, countTokens_js_1.compileChatMessages)({
                modelName: completionOptions.model,
                msgs: _messages,
                knownContextLength: this._contextLength,
                maxTokens: completionOptions.maxTokens ?? constants_js_1.DEFAULT_MAX_TOKENS,
                supportsImages: this.supportsImages(),
                tools: options.tools,
            });
            messages = compiledChatMessages;
        }
        const messagesCopy = [...messages]; // templateMessages may modify messages.
        const prompt = this.templateMessages
            ? this.templateMessages(messagesCopy)
            : this._formatChatMessages(messagesCopy);
        if (logEnabled) {
            interaction?.logItem({
                kind: "startChat",
                messages,
                options: completionOptions,
                provider: this.providerName,
            });
            if (this.llmRequestHook) {
                this.llmRequestHook(completionOptions.model, prompt);
            }
        }
        // Performance optimization: Use arrays instead of string concatenation.
        // String concatenation in loops creates new string objects for each operation,
        // which is O(n²) for n chunks. Arrays with push() are O(1) per operation,
        // making the total O(n). We join() only once at the end.
        const thinking = [];
        const completion = [];
        let usage = undefined;
        let citations = null;
        try {
            if (this.templateMessages) {
                for await (const chunk of this._streamComplete(prompt, signal, completionOptions)) {
                    completion.push(chunk);
                    interaction?.logItem({
                        kind: "chunk",
                        chunk: chunk,
                    });
                    yield { role: "assistant", content: chunk };
                }
            }
            else {
                if (this.shouldUseOpenAIAdapter("streamChat") && this.openaiAdapter) {
                    let body = (0, openaiTypeConverters_js_1.toChatBody)(messages, completionOptions, {
                        includeReasoningField: this.supportsReasoningField,
                        includeReasoningDetailsField: this.supportsReasoningDetailsField,
                    });
                    body = this.modifyChatBody(body);
                    if (logEnabled) {
                        interaction?.logItem({
                            kind: "startChat",
                            messages,
                            options: {
                                ...completionOptions,
                                requestBody: body,
                            },
                            provider: this.providerName,
                        });
                        if (this.llmRequestHook) {
                            this.llmRequestHook(completionOptions.model, prompt);
                        }
                    }
                    const canUseResponses = this.canUseOpenAIResponses(completionOptions);
                    const useStream = completionOptions.stream !== false;
                    let iterable;
                    if (canUseResponses) {
                        iterable = useStream
                            ? this.responsesStream(messages, signal, completionOptions)
                            : this.responsesNonStream(messages, signal, completionOptions);
                    }
                    else {
                        iterable = useStream
                            ? this.openAIAdapterStream(body, signal, (c) => {
                                if (!citations) {
                                    citations = c;
                                }
                            })
                            : this.openAIAdapterNonStream(body, signal);
                    }
                    for await (const chunk of iterable) {
                        const result = this.processChatChunk(chunk, interaction);
                        completion.push(...result.completion);
                        thinking.push(...result.thinking);
                        if (result.usage !== null) {
                            usage = result.usage;
                        }
                        yield result.chunk;
                    }
                }
                else {
                    if (logEnabled) {
                        interaction?.logItem({
                            kind: "startChat",
                            messages,
                            options: completionOptions,
                            provider: this.providerName,
                        });
                        if (this.llmRequestHook) {
                            this.llmRequestHook(completionOptions.model, prompt);
                        }
                    }
                    for await (const chunk of this._streamChat(messages, signal, completionOptions)) {
                        const result = this.processChatChunk(chunk, interaction);
                        completion.push(...result.completion);
                        thinking.push(...result.thinking);
                        if (result.usage !== null) {
                            usage = result.usage;
                        }
                        yield result.chunk;
                    }
                }
            }
            if (citations) {
                const cits = citations;
                interaction?.logItem({
                    kind: "message",
                    message: {
                        role: "assistant",
                        content: `\n\nCitations:\n${cits.map((c, i) => `${i + 1}: ${c}`).join("\n")}\n\n`,
                    },
                });
            }
            status = this._logEnd(completionOptions.model, prompt, completion.join(""), thinking.join(""), interaction, usage);
        }
        catch (e) {
            // Capture chat streaming failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "llm_stream_chat",
                model: completionOptions.model,
                provider: this.providerName,
                useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamChat"),
                streamEnabled: completionOptions.stream !== false,
                templateMessages: !!this.templateMessages,
            });
            status = this._logEnd(completionOptions.model, prompt, completion.join(""), thinking.join(""), interaction, usage, e);
            throw e;
        }
        finally {
            if (status === "in_progress") {
                this._logEnd(completionOptions.model, prompt, completion.join(""), undefined, interaction, usage, "cancel");
            }
        }
        /*
      TODO: According to: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
      During tool use, you must pass thinking and redacted_thinking blocks back to the API,
      and you must include the complete unmodified block back to the API. This is critical
      for maintaining the model's reasoning flow and conversation integrity.
    
      On the other hand, adding thinking and redacted_thinking blocks are ignored on subsequent
      requests when not using tools, so it's the simplest option to always add to history.
      */
        return {
            modelTitle: this.title ?? completionOptions.model,
            modelProvider: this.underlyingProviderName,
            prompt,
            completion: completion.join(""),
        };
    }
    getBatchedChunks(chunks) {
        const batchedChunks = [];
        for (let i = 0; i < chunks.length; i += this.maxEmbeddingBatchSize) {
            batchedChunks.push(chunks.slice(i, i + this.maxEmbeddingBatchSize));
        }
        return batchedChunks;
    }
    async embed(chunks) {
        const batches = this.getBatchedChunks(chunks);
        return (await Promise.all(batches.map(async (batch) => {
            if (batch.length === 0) {
                return [];
            }
            const embeddings = await (0, withExponentialBackoff_js_1.withExponentialBackoff)(async () => {
                if (this.shouldUseOpenAIAdapter("embed") && this.openaiAdapter) {
                    const result = await this.openaiAdapter.embed({
                        model: this.model,
                        input: batch,
                    });
                    return result.data.map((chunk) => chunk.embedding);
                }
                return await this._embed(batch);
            });
            return embeddings;
        }))).flat();
    }
    async rerank(query, chunks) {
        if (this.shouldUseOpenAIAdapter("rerank") && this.openaiAdapter) {
            const results = await this.openaiAdapter.rerank({
                model: this.model,
                query,
                documents: chunks.map((chunk) => chunk.content),
            });
            // Standard OpenAI format
            if (results.data && Array.isArray(results.data)) {
                return results.data
                    .sort((a, b) => a.index - b.index)
                    .map((result) => result.relevance_score);
            }
            throw new Error(`Unexpected rerank response format from ${this.providerName}. ` +
                `Expected 'data' array but got: ${JSON.stringify(Object.keys(results))}`);
        }
        throw new Error(`Reranking is not supported for provider type ${this.providerName}`);
    }
    async *_streamComplete(prompt, signal, options) {
        throw new Error("Not implemented");
    }
    async *_streamChat(messages, signal, options) {
        if (!this.templateMessages) {
            throw new Error("You must either implement templateMessages or _streamChat");
        }
        for await (const chunk of this._streamComplete(this.templateMessages(messages), signal, options)) {
            yield { role: "assistant", content: chunk };
        }
    }
    async _complete(prompt, signal, options) {
        let completion = "";
        for await (const chunk of this._streamComplete(prompt, signal, options)) {
            completion += chunk;
        }
        return completion;
    }
    async _embed(chunks) {
        throw new Error(`Embedding is not supported for provider type ${this.providerName}`);
    }
    countTokens(text) {
        return (0, countTokens_js_1.countTokens)(text, this.model);
    }
    collectArgs(options) {
        return {
            ...constants_js_1.DEFAULT_ARGS,
            // model: this.model,
            ...options,
        };
    }
    renderPromptTemplate(template, history, otherData, canPutWordsInModelsMouth = false) {
        if (typeof template === "string") {
            const data = {
                history: history,
                ...otherData,
            };
            if (history.length > 0 && history[0].role === "system") {
                data.system_message = history.shift().content;
            }
            const compiledTemplate = handlebars_1.default.compile(template);
            return compiledTemplate(data);
        }
        const rendered = template(history, {
            ...otherData,
            supportsCompletions: this.supportsCompletions() ? "true" : "false",
            supportsPrefill: this.supportsPrefill() ? "true" : "false",
        });
        if (typeof rendered !== "string" &&
            rendered[rendered.length - 1]?.role === "assistant" &&
            !canPutWordsInModelsMouth) {
            // Some providers don't allow you to put words in the model's mouth
            // So we have to manually compile the prompt template and use
            // raw /completions, not /chat/completions
            const templateMessages = (0, autodetect_js_1.autodetectTemplateFunction)(this.model, this.providerName, (0, autodetect_js_1.autodetectTemplateType)(this.model));
            if (templateMessages) {
                return templateMessages(rendered);
            }
        }
        return rendered;
    }
}
exports.BaseLLM = BaseLLM;
BaseLLM.defaultOptions = undefined;
//# sourceMappingURL=index.js.map