"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const async_mutex_1 = require("async-mutex");
const uuid_1 = require("uuid");
const fetch_1 = require("@continuedev/fetch");
const messageContent_js_1 = require("../../util/messageContent.js");
const ollamaHelper_js_1 = require("../../util/ollamaHelper.js");
const url_js_1 = require("../../util/url.js");
const index_js_1 = require("../index.js");
class Ollama extends index_js_1.BaseLLM {
    constructor(options) {
        super(options);
        this.fimSupported = false;
        // Map of "continue model name" to Ollama actual model name
        this.modelMap = {
            "mistral-7b": "mistral:7b",
            "mixtral-8x7b": "mixtral:8x7b",
            "llama2-7b": "llama2:7b",
            "llama2-13b": "llama2:13b",
            "codellama-7b": "codellama:7b",
            "codellama-13b": "codellama:13b",
            "codellama-34b": "codellama:34b",
            "codellama-70b": "codellama:70b",
            "llama3-8b": "llama3:8b",
            "llama3-70b": "llama3:70b",
            "llama3.1-8b": "llama3.1:8b",
            "llama3.1-70b": "llama3.1:70b",
            "llama3.1-405b": "llama3.1:405b",
            "llama3.2-1b": "llama3.2:1b",
            "llama3.2-3b": "llama3.2:3b",
            "llama3.2-11b": "llama3.2:11b",
            "llama3.2-90b": "llama3.2:90b",
            "phi-2": "phi:2.7b",
            "phind-codellama-34b": "phind-codellama:34b-v2",
            "qwen2.5-coder-0.5b": "qwen2.5-coder:0.5b",
            "qwen2.5-coder-1.5b": "qwen2.5-coder:1.5b",
            "qwen2.5-coder-3b": "qwen2.5-coder:3b",
            "qwen2.5-coder-7b": "qwen2.5-coder:7b",
            "qwen2.5-coder-14b": "qwen2.5-coder:14b",
            "qwen2.5-coder-32b": "qwen2.5-coder:32b",
            "wizardcoder-7b": "wizardcoder:7b-python",
            "wizardcoder-13b": "wizardcoder:13b-python",
            "wizardcoder-34b": "wizardcoder:34b-python",
            "zephyr-7b": "zephyr:7b",
            "codeup-13b": "codeup:13b",
            "deepseek-1b": "deepseek-coder:1.3b",
            "deepseek-7b": "deepseek-coder:6.7b",
            "deepseek-33b": "deepseek-coder:33b",
            "neural-chat-7b": "neural-chat:7b-v3.3",
            "starcoder-1b": "starcoder:1b",
            "starcoder-3b": "starcoder:3b",
            "starcoder2-3b": "starcoder2:3b",
            "stable-code-3b": "stable-code:3b",
            "granite-code-3b": "granite-code:3b",
            "granite-code-8b": "granite-code:8b",
            "granite-code-20b": "granite-code:20b",
            "granite-code-34b": "granite-code:34b",
        };
        if (options.model === "AUTODETECT") {
            return;
        }
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        this.fetch(this.getEndpoint("api/show"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ name: this._getModel() }),
        })
            .then(async (response) => {
            if (response?.status !== 200) {
                // console.warn(
                //   "Error calling Ollama /api/show endpoint: ",
                //   await response.text(),
                // );
                return;
            }
            const body = await response.json();
            if (body.parameters) {
                const params = [];
                for (const line of body.parameters.split("\n")) {
                    let parts = line.match(/^(\S+)\s+((?:".*")|\S+)$/);
                    if (parts.length < 2) {
                        continue;
                    }
                    let key = parts[1];
                    let value = parts[2];
                    switch (key) {
                        case "num_ctx":
                            this._contextLength =
                                options.contextLength ?? Number.parseInt(value);
                            break;
                        case "stop":
                            if (!this.completionOptions.stop) {
                                this.completionOptions.stop = [];
                            }
                            try {
                                this.completionOptions.stop.push(JSON.parse(value));
                            }
                            catch (e) {
                                console.warn(`Error parsing stop parameter value "{value}: ${e}`);
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            /**
             * There is no API to get the model's FIM capabilities, so we have to
             * make an educated guess. If a ".Suffix" variable appears in the template
             * it's a good indication the model supports FIM.
             */
            this.fimSupported = !!body?.template?.includes(".Suffix");
        })
            .catch((e) => {
            // console.warn("Error calling the Ollama /api/show endpoint: ", e);
        });
    }
    _getModel() {
        return this.modelMap[this.model] ?? this.model;
    }
    get contextLength() {
        const DEFAULT_OLLAMA_CONTEXT_LENGTH = 8192; // twice of https://github.com/ollama/ollama/blob/29ddfc2cab7f5a83a96c3133094f67b22e4f27d1/envconfig/config.go#L185
        return this._contextLength ?? DEFAULT_OLLAMA_CONTEXT_LENGTH;
    }
    _getModelFileParams(options) {
        return {
            temperature: options.temperature,
            top_p: options.topP,
            top_k: options.topK,
            num_predict: options.maxTokens,
            stop: options.stop,
            num_ctx: this.contextLength,
            mirostat: options.mirostat,
            num_thread: options.numThreads,
            use_mmap: options.useMmap,
            min_p: options.minP,
            num_gpu: options.numGpu,
        };
    }
    _convertToOllamaMessage(message) {
        const ollamaMessage = {
            role: message.role,
            content: "",
        };
        ollamaMessage.content = (0, messageContent_js_1.renderChatMessage)(message);
        if (Array.isArray(message.content)) {
            const images = [];
            message.content.forEach((part) => {
                if (part.type === "imageUrl" && part.imageUrl) {
                    const image = part.imageUrl?.url
                        ? (0, url_js_1.extractBase64FromDataUrl)(part.imageUrl.url)
                        : undefined;
                    if (image) {
                        images.push(image);
                    }
                    else if (part.imageUrl?.url) {
                        console.warn("Ollama: skipping image with invalid data URL format", part.imageUrl.url);
                    }
                }
            });
            if (images.length > 0) {
                ollamaMessage.images = images;
            }
        }
        return ollamaMessage;
    }
    _getGenerateOptions(options, prompt, suffix) {
        return {
            model: this._getModel(),
            prompt,
            suffix,
            raw: options.raw,
            options: this._getModelFileParams(options),
            keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
            stream: options.stream,
            // Not supported yet: context, images, system, template, format
        };
    }
    getEndpoint(endpoint) {
        let base = this.apiBase;
        if (process.env.IS_BINARY) {
            base = base?.replace("localhost", "127.0.0.1");
        }
        return new URL(endpoint, base);
    }
    async *_streamComplete(prompt, signal, options) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const response = await this.fetch(this.getEndpoint("api/generate"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify(this._getGenerateOptions(options, prompt)),
            signal,
        });
        let buffer = "";
        for await (const value of (0, fetch_1.streamResponse)(response)) {
            // Append the received chunk to the buffer
            buffer += value;
            // Split the buffer into individual JSON chunks
            const chunks = buffer.split("\n");
            buffer = chunks.pop() ?? "";
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.trim() !== "") {
                    try {
                        const j = JSON.parse(chunk);
                        if ("error" in j) {
                            throw new Error(j.error);
                        }
                        j.response ?? (j.response = "");
                        yield j.response;
                    }
                    catch (e) {
                        throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
                    }
                }
            }
        }
    }
    async *_streamChat(messages, signal, options) {
        const ollamaMessages = messages.map(this._convertToOllamaMessage);
        const chatOptions = {
            model: this._getModel(),
            messages: ollamaMessages,
            options: this._getModelFileParams(options),
            think: options.reasoning,
            keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
            stream: options.stream,
            // format: options.format, // Not currently in base completion options
        };
        // This logic is because tools can ONLY be included with user message for ollama
        if (options.tools?.length && ollamaMessages.at(-1)?.role === "user") {
            chatOptions.tools = options.tools.map((tool) => ({
                type: "function",
                function: {
                    name: tool.function.name,
                    description: tool.function.description,
                    parameters: tool.function.parameters,
                },
            }));
        }
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const response = await this.fetch(this.getEndpoint("api/chat"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify(chatOptions),
            signal,
        });
        let isThinking = false;
        function convertChatMessage(res) {
            if ("error" in res) {
                throw new Error(res.error);
            }
            if ("type" in res) {
                const { content } = res;
                if (content === "<think>") {
                    isThinking = true;
                }
                if (isThinking && content) {
                    // TODO better support for streaming thinking chunks, or remove this and depend on redux <think/> parsing logic
                    const thinkingMessage = {
                        role: "thinking",
                        content: content,
                    };
                    if (thinkingMessage) {
                        // could cause issues with termination if chunk doesn't match this exactly
                        if (content === "</think>") {
                            isThinking = false;
                        }
                        // When Streaming you can't have both thinking and content
                        return [thinkingMessage];
                    }
                }
                if (content) {
                    const chatMessage = {
                        role: "assistant",
                        content: content,
                    };
                    return [chatMessage];
                }
                return [];
            }
            const { role, content, thinking, tool_calls: toolCalls } = res.message;
            if (role === "tool") {
                throw new Error("Unexpected message received from Ollama with role = tool");
            }
            if (role === "assistant") {
                const thinkingMessage = thinking
                    ? { role: "thinking", content: thinking }
                    : null;
                if (thinkingMessage && !content) {
                    // When Streaming you can't have both thinking and content
                    return [thinkingMessage];
                }
                // Either not thinking, or not streaming
                const chatMessage = { role: "assistant", content };
                if (toolCalls?.length) {
                    // Continue handles the response as a tool call delta but
                    // But ollama returns the full object in one response with no streaming
                    chatMessage.toolCalls = toolCalls.map((tc) => ({
                        type: "function",
                        id: `tc_${(0, uuid_1.v4)()}`, // Generate a proper UUID with a prefix
                        function: {
                            name: tc.function.name,
                            arguments: JSON.stringify(tc.function.arguments),
                        },
                    }));
                }
                // Return both thinking and chat messages if applicable
                return thinkingMessage ? [thinkingMessage, chatMessage] : [chatMessage];
            }
            // Fallback for all other roles
            return [{ role, content }];
        }
        if (chatOptions.stream === false) {
            if (response.status === 499) {
                return; // Aborted by user
            }
            const json = (await response.json());
            for (const msg of convertChatMessage(json)) {
                yield msg;
            }
        }
        else {
            let buffer = "";
            for await (const value of (0, fetch_1.streamResponse)(response)) {
                // Append the received chunk to the buffer
                buffer += value;
                // Split the buffer into individual JSON chunks
                const chunks = buffer.split("\n");
                buffer = chunks.pop() ?? "";
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (chunk.trim() !== "") {
                        try {
                            const j = JSON.parse(chunk);
                            for (const msg of convertChatMessage(j)) {
                                yield msg;
                            }
                        }
                        catch (e) {
                            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
                        }
                    }
                }
            }
        }
    }
    supportsFim() {
        return this.fimSupported;
    }
    async *_streamFim(prefix, suffix, signal, options) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const response = await this.fetch(this.getEndpoint("api/generate"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify(this._getGenerateOptions(options, prefix, suffix)),
            signal,
        });
        let buffer = "";
        for await (const value of (0, fetch_1.streamResponse)(response)) {
            // Append the received chunk to the buffer
            buffer += value;
            // Split the buffer into individual JSON chunks
            const chunks = buffer.split("\n");
            buffer = chunks.pop() ?? "";
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.trim() !== "") {
                    try {
                        const j = JSON.parse(chunk);
                        if ("response" in j) {
                            yield j.response;
                        }
                        else if ("error" in j) {
                            throw new Error(j.error);
                        }
                    }
                    catch (e) {
                        throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
                    }
                }
            }
        }
    }
    async listModels() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const response = await this.fetch(
        // localhost was causing fetch failed in pkg binary only for this Ollama endpoint
        this.getEndpoint("api/tags"), {
            method: "GET",
            headers: headers,
        });
        const data = await response.json();
        if (response.ok) {
            return data.models.map((model) => model.name);
        }
        else {
            throw new Error("Failed to list Ollama models. Make sure Ollama is running.");
        }
    }
    async _embed(chunks) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const resp = await this.fetch(new URL("api/embed", this.apiBase), {
            method: "POST",
            body: JSON.stringify({
                model: this.model,
                input: chunks,
            }),
            headers: headers,
        });
        if (!resp.ok) {
            throw new Error(`Failed to embed chunk: ${await resp.text()}`);
        }
        const data = await resp.json();
        const embedding = data.embeddings;
        if (!embedding || embedding.length === 0) {
            throw new Error("Ollama generated empty embedding");
        }
        return embedding;
    }
    async installModel(modelName, signal, progressReporter) {
        const modelInfo = await (0, ollamaHelper_js_1.getRemoteModelInfo)(modelName, signal);
        if (!modelInfo) {
            throw new Error(`'${modelName}' not found in the Ollama registry!`);
        }
        const release = await Ollama.modelsBeingInstalledMutex.acquire();
        try {
            if (Ollama.modelsBeingInstalled.has(modelName)) {
                throw new Error(`Model '${modelName}' is already being installed.`);
            }
            Ollama.modelsBeingInstalled.add(modelName);
        }
        finally {
            release();
        }
        try {
            const response = await fetch(this.getEndpoint("api/pull"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({ name: modelName }),
                signal,
            });
            const reader = response.body?.getReader();
            //TODO: generate proper progress based on modelInfo size
            while (true) {
                const { done, value } = (await reader?.read()) || {
                    done: true,
                    value: undefined,
                };
                if (done) {
                    break;
                }
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split("\n").filter(Boolean);
                for (const line of lines) {
                    const data = JSON.parse(line);
                    progressReporter?.(data.status, data.completed, data.total);
                }
            }
        }
        finally {
            const release = await Ollama.modelsBeingInstalledMutex.acquire();
            try {
                Ollama.modelsBeingInstalled.delete(modelName);
            }
            finally {
                release();
            }
        }
    }
    async isInstallingModel(modelName) {
        const release = await Ollama.modelsBeingInstalledMutex.acquire();
        try {
            return Ollama.modelsBeingInstalled.has(modelName);
        }
        finally {
            release();
        }
    }
}
Ollama.providerName = "ollama";
Ollama.defaultOptions = {
    apiBase: "http://localhost:11434/",
    model: "codellama-7b",
    maxEmbeddingBatchSize: 64,
};
Ollama.modelsBeingInstalled = new Set();
Ollama.modelsBeingInstalledMutex = new async_mutex_1.Mutex();
exports.default = Ollama;
//# sourceMappingURL=Ollama.js.map