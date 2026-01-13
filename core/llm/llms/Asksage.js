"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const form_data_1 = __importDefault(require("form-data"));
const index_js_1 = require("../index.js");
const DEFAULT_API_URL = "https://api.asksage.ai/server";
const DEFAULT_USER_API_URL = "https://api.asksage.ai/user";
const TOKEN_TTL = 3600000; // 1 hour in milliseconds
class Asksage extends index_js_1.BaseLLM {
    constructor(options) {
        super(options);
        this.sessionTokenPromise = null;
        this.tokenTimestamp = 0;
        this.apiVersion = options.apiVersion ?? "v1.2.4";
        this.email = process.env.ASKSAGE_EMAIL;
        this.userApiUrl = process.env.ASKSAGE_USER_API_URL || DEFAULT_USER_API_URL;
    }
    async getSessionToken() {
        if (!this.apiKey) {
            throw new Error("AskSage adapter: missing ASKSAGE_API_KEY. Provide it in your environment variables or .env file.");
        }
        // If no email, use API key directly
        if (!this.email || this.email.length === 0) {
            return this.apiKey;
        }
        const url = this.userApiUrl.replace(/\/$/, "") + "/get-token-with-api-key";
        const res = await this.fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: this.email, api_key: this.apiKey }),
        });
        const data = (await res.json());
        if (parseInt(String(data.status)) !== 200) {
            throw new Error("Error getting access token: " + JSON.stringify(data));
        }
        return data.response.access_token;
    }
    async getToken() {
        // Check if token needs refresh
        if (!this.sessionTokenPromise ||
            Date.now() - this.tokenTimestamp > TOKEN_TTL) {
            this.sessionTokenPromise = this.getSessionToken();
            this.tokenTimestamp = Date.now();
        }
        return this.sessionTokenPromise;
    }
    isFileLike(val) {
        return (val !== null &&
            val !== undefined &&
            ((typeof File !== "undefined" && val instanceof File) ||
                (typeof Buffer !== "undefined" && val instanceof Buffer) ||
                (typeof val === "object" &&
                    ("path" in val || "name" in val || "type" in val))));
    }
    toFormData(args) {
        const form = new form_data_1.default();
        for (const [key, value] of Object.entries(args)) {
            if (value === undefined || value === null)
                continue;
            if (key === "file" && value) {
                if (Buffer.isBuffer(value)) {
                    form.append("file", value, "file");
                }
                else if (typeof value === "string") {
                    form.append("file", value);
                }
                else {
                    form.append("file", value);
                }
            }
            else if (Array.isArray(value) || typeof value === "object") {
                form.append(key, JSON.stringify(value));
            }
            else {
                form.append(key, String(value));
            }
        }
        return form;
    }
    _convertMessage(message) {
        return {
            user: message.role === "assistant" ? "gpt" : "me",
            message: typeof message.content === "string"
                ? message.content
                : message.content
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join(""),
        };
    }
    _convertArgs(options, messages) {
        let formattedMessage;
        if (messages.length === 1) {
            formattedMessage = messages[0].content;
        }
        else {
            formattedMessage = messages.map(this._convertMessage);
        }
        const args = {
            message: formattedMessage,
            model: options.model,
            temperature: options.temperature ?? 0.0,
            mode: "chat", // Always use chat mode
            limit_references: 0, // Always use 0
            persona: options.persona,
            system_prompt: options.systemPrompt ??
                process.env.ASKSAGE_SYSTEM_PROMPT ??
                "You are an expert software developer. You give helpful and concise responses.",
            tools: options.askSageTools,
            // enabled_mcp_tools: options.enabledMcpTools as string[] | undefined,
            // tools_to_execute: options.toolsToExecute as string[] | undefined,
            tool_choice: options.askSageToolChoice,
            reasoning_effort: options.reasoningEffort,
            deep_agent_id: options.deepAgentId,
            streaming: options.streaming,
            file: options.file,
        };
        // Remove undefined values
        Object.keys(args).forEach((key) => args[key] === undefined &&
            delete args[key]);
        return args;
    }
    async _getHeaders(hasFile = false) {
        const token = await this.getToken();
        const headers = {
            accept: "application/json",
            "x-access-tokens": token,
        };
        if (!hasFile) {
            headers["Content-Type"] = "application/json";
        }
        return headers;
    }
    _getEndpoint(endpoint) {
        if (!this.apiBase) {
            throw new Error("No API base URL provided. Please set the 'apiBase' option.");
        }
        return new URL(endpoint, this.apiBase);
    }
    async _complete(prompt, signal, options) {
        if (typeof prompt !== "string" || prompt.trim() === "") {
            throw new Error("Prompt must be a non-empty string.");
        }
        const messages = [{ role: "user", content: prompt }];
        const args = this._convertArgs(options, messages);
        const hasFile = this.isFileLike(args.file);
        const endpoint = hasFile ? "query_with_file" : "query";
        try {
            let response;
            if (hasFile) {
                const form = this.toFormData(args);
                const headers = await this._getHeaders(true);
                response = await this.fetch(this._getEndpoint(endpoint), {
                    method: "POST",
                    headers: {
                        ...headers,
                        ...form.getHeaders(),
                    },
                    body: form,
                    signal,
                });
            }
            else {
                const headers = await this._getHeaders(false);
                response = await this.fetch(this._getEndpoint(endpoint), {
                    method: "POST",
                    headers,
                    body: JSON.stringify(args),
                    signal,
                });
            }
            if (response.status === 499) {
                return ""; // Aborted by user
            }
            if (!response.ok) {
                const errText = await response.text();
                // Clear token cache on 401
                if (response.status === 401) {
                    this.sessionTokenPromise = null;
                    this.tokenTimestamp = 0;
                }
                throw new Error(`AskSage API error: ${response.status} ${response.statusText}: ${errText}`);
            }
            const data = (await response.json());
            return (data.text ||
                data.answer ||
                data.message ||
                data.choices?.[0]?.message?.content ||
                "");
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`AskSage client error: ${error.message}`);
            }
            throw error;
        }
    }
    async *_streamComplete(prompt, signal, options) {
        const completion = await this._complete(prompt, signal, options);
        yield completion;
    }
    async *_streamChat(messages, signal, options) {
        const args = this._convertArgs(options, messages);
        const hasFile = this.isFileLike(args.file);
        const endpoint = hasFile ? "query_with_file" : "query";
        try {
            let response;
            if (hasFile) {
                const form = this.toFormData(args);
                const headers = await this._getHeaders(true);
                response = await this.fetch(this._getEndpoint(endpoint), {
                    method: "POST",
                    headers: {
                        ...headers,
                        ...form.getHeaders(),
                    },
                    body: form,
                    signal,
                });
            }
            else {
                const headers = await this._getHeaders(false);
                response = await this.fetch(this._getEndpoint(endpoint), {
                    method: "POST",
                    headers,
                    body: JSON.stringify(args),
                    signal,
                });
            }
            if (response.status === 499) {
                return; // Aborted by user
            }
            if (!response.ok) {
                const errText = await response.text();
                // Clear token cache on 401
                if (response.status === 401) {
                    this.sessionTokenPromise = null;
                    this.tokenTimestamp = 0;
                }
                throw new Error(`AskSage API error: ${response.status} ${response.statusText}: ${errText}`);
            }
            const data = (await response.json());
            const assistantMessage = {
                role: "assistant",
                content: data.text ||
                    data.answer ||
                    data.message ||
                    data.choices?.[0]?.message?.content ||
                    "",
            };
            yield assistantMessage;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`AskSage client error: ${error.message}`);
            }
            throw error;
        }
    }
    async listModels() {
        return [];
    }
}
Asksage.providerName = "askSage";
Asksage.defaultOptions = {
    apiBase: DEFAULT_API_URL,
    model: "gpt-4o",
};
exports.default = Asksage;
//# sourceMappingURL=Asksage.js.map