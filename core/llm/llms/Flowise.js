"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const messageContent_js_1 = require("../../util/messageContent.js");
const index_js_1 = require("../index.js");
class Flowise extends index_js_1.BaseLLM {
    constructor(options) {
        super(options);
        this.additionalFlowiseConfiguration = [];
        this.timeout = 5000;
        this.additionalHeaders = [];
        this.timeout = options.timeout ?? 5000;
        this.additionalHeaders = options.additionalHeaders ?? [];
        this.additionalFlowiseConfiguration =
            options.additionalFlowiseConfiguration ?? [];
    }
    _getChatUrl() {
        return String(this.apiBase);
    }
    _getSocketUrl() {
        return new URL(this._getChatUrl()).origin;
    }
    _getHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        for (const additionalHeader of this.additionalHeaders) {
            headers[additionalHeader.key] = additionalHeader.value;
        }
        return headers;
    }
    _convertArgs(options) {
        const finalOptions = {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            topK: options.topK,
            presencePenalty: options.presencePenalty,
            frequencyPenalty: options.frequencyPenalty,
        };
        for (const additionalConfig of this.additionalFlowiseConfiguration) {
            finalOptions[additionalConfig.key] = additionalConfig.value;
        }
        return finalOptions;
    }
    async *_streamComplete(prompt, signal, options) {
        const message = { role: "user", content: prompt };
        for await (const chunk of this._streamChat([message], signal, options)) {
            yield (0, messageContent_js_1.renderChatMessage)(chunk);
        }
    }
    async *_streamChat(messages, signal, options) {
        const requestBody = this._getRequestBody(messages, options);
        const { socket, socketInfo } = await this._initializeSocket();
        const response = await this.fetch(this._getChatUrl(), {
            method: "POST",
            headers: this._getHeaders(),
            body: JSON.stringify({ ...requestBody, socketIOClientId: socket.id }),
            signal,
        });
        if (response.status === 499) {
            return; // Aborted by user
        }
        while (await socketInfo.hasNextToken()) {
            yield { role: "assistant", content: socketInfo.getCurrentMessage() };
        }
        if (socketInfo.error) {
            socket.disconnect();
            try {
                yield { role: "assistant", content: await response.text() };
            }
            catch (error) {
                yield { role: "assistant", content: error.message ?? error };
            }
        }
        socket.disconnect();
    }
    _getRequestBody(messages, options) {
        const lastMessage = messages[messages.length - 1];
        const history = messages
            .filter((m) => m !== lastMessage)
            .map((m) => ({
            type: m.role === "user"
                ? Flowise.FlowiseMessageType.User
                : Flowise.FlowiseMessageType.Assistant,
            message: m.content,
        }));
        const requestBody = {
            question: lastMessage.content,
            history: history,
            overrideConfig: this._convertArgs(options),
        };
        return requestBody;
    }
    _initializeSocket() {
        return new Promise((res, rej) => {
            const socket = (0, socket_io_client_1.default)(this._getSocketUrl());
            const socketInfo = {
                isConnected: false,
                hasNextToken: () => Promise.resolve(false),
                internal: {
                    hasNextTokenPromiseResolve: () => { },
                    hasNextTokenPromiseReject: () => { },
                    messageHistory: [],
                },
                getCurrentMessage: () => "",
            };
            socketInfo.getCurrentMessage = () => socketInfo.internal.messageHistory.shift() ?? "";
            socketInfo.hasNextToken = () => {
                return new Promise((hasNextTokenResolve, hasNextTokenReject) => {
                    socketInfo.internal.hasNextTokenPromiseResolve =
                        hasNextTokenResolve;
                    socketInfo.internal.hasNextTokenPromiseReject = hasNextTokenReject;
                });
            };
            const resetTimeout = () => {
                clearTimeout(socketInfo.internal.timeout);
                socketInfo.internal.timeout = setTimeout(() => {
                    socketInfo.error = new Error("Timeout occurred");
                    socketInfo.internal.hasNextTokenPromiseResolve(false);
                    rej(`Timeout trying to connect to socket: ${this._getSocketUrl()}`);
                }, this.timeout);
            };
            resetTimeout();
            socket.on("connect", () => {
                socketInfo.isConnected = true;
                resetTimeout();
                res({ socket, socketInfo });
            });
            socket.on("token", (token) => {
                if (socketInfo.isConnected) {
                    socketInfo.internal.messageHistory.push(token);
                    resetTimeout();
                    socketInfo.internal.hasNextTokenPromiseResolve(true);
                }
            });
            socket.on("error", (error) => {
                clearTimeout(socketInfo.internal.timeout);
                socketInfo.error = error;
                socketInfo.internal.hasNextTokenPromiseResolve(false);
                rej(`Error trying to connect to socket: ${this._getSocketUrl()}`);
            });
            socket.on("end", () => {
                clearTimeout(socketInfo.internal.timeout);
                socketInfo.hasNextToken = () => Promise.resolve(Boolean(socketInfo.internal.messageHistory.length));
            });
            socket.on("disconnect", () => {
                socketInfo.isConnected = false;
                clearTimeout(socketInfo.internal.timeout);
                socketInfo.internal.hasNextTokenPromiseResolve(false);
            });
        });
    }
}
Flowise.providerName = "flowise";
Flowise.defaultOptions = {
    apiBase: "http://localhost:3000",
};
Flowise.FlowiseMessageType = {
    User: "userMessage",
    Assistant: "apiMessage",
};
exports.default = Flowise;
//# sourceMappingURL=Flowise.js.map