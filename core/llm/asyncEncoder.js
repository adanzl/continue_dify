"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPTAsyncEncoder = exports.LlamaAsyncEncoder = void 0;
const path_1 = __importDefault(require("path"));
const workerpool_1 = __importDefault(require("workerpool"));
class LlamaAsyncEncoder {
    constructor() {
        this.workerPool = workerpool_1.default.pool(workerCodeFilePath("llamaTokenizerWorkerPool.mjs"));
    }
    async encode(text) {
        return this.workerPool.exec("encode", [text]);
    }
    async decode(tokens) {
        return this.workerPool.exec("decode", [tokens]);
    }
    // TODO: this should be called somewhere before exit or potentially with a shutdown hook
    async close() {
        await this.workerPool.terminate();
    }
}
exports.LlamaAsyncEncoder = LlamaAsyncEncoder;
// this class does not yet do anything asynchronous
class GPTAsyncEncoder {
    constructor() {
        this.workerPool = workerpool_1.default.pool(workerCodeFilePath("tiktokenWorkerPool.mjs"));
    }
    async encode(text) {
        return this.workerPool.exec("encode", [text]);
    }
    async decode(tokens) {
        return this.workerPool.exec("decode", [tokens]);
    }
    // TODO: this should be called somewhere before exit or potentially with a shutdown hook
    async close() {
        await this.workerPool.terminate();
    }
}
exports.GPTAsyncEncoder = GPTAsyncEncoder;
function workerCodeFilePath(workerFileName) {
    if (process.env.NODE_ENV === "test") {
        // `cross-env` seems to make it so __dirname is the root of the project and not the directory containing this file
        return path_1.default.join(__dirname, "llm", workerFileName);
    }
    return path_1.default.join(__dirname, workerFileName);
}
//# sourceMappingURL=asyncEncoder.js.map