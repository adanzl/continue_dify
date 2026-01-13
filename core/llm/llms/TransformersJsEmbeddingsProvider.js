"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformersJsEmbeddingsProvider = void 0;
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../../llm/index.js");
class EmbeddingsPipeline {
    static async getInstance() {
        if (EmbeddingsPipeline.instance === null) {
            // @ts-ignore
            // prettier-ignore
            const { env, pipeline } = await Promise.resolve().then(() => __importStar(require("../../vendor/modules/@xenova/transformers/src/transformers.js")));
            env.allowLocalModels = true;
            env.allowRemoteModels = false;
            env.localModelPath = path_1.default.join(typeof __dirname === "undefined"
                ? // @ts-ignore
                    path_1.default.dirname(new URL(import.meta.url).pathname)
                : __dirname, "..", "models");
            EmbeddingsPipeline.instance = await pipeline(EmbeddingsPipeline.task, EmbeddingsPipeline.model);
        }
        return EmbeddingsPipeline.instance;
    }
}
EmbeddingsPipeline.task = "feature-extraction";
EmbeddingsPipeline.model = "all-MiniLM-L6-v2";
EmbeddingsPipeline.instance = null;
class TransformersJsEmbeddingsProvider extends index_js_1.BaseLLM {
    constructor() {
        super({
            model: TransformersJsEmbeddingsProvider.model,
            title: "Transformers.js (Built-In)",
        });
    }
    async embed(chunks) {
        // Workaround to ignore testing issues in Jest
        if (process.env.NODE_ENV === "test") {
            return chunks.map(() => TransformersJsEmbeddingsProvider.mockVector);
        }
        const extractor = await EmbeddingsPipeline.getInstance();
        if (!extractor) {
            throw new Error("TransformerJS embeddings pipeline is not initialized");
        }
        if (chunks.length === 0) {
            return [];
        }
        const outputs = [];
        for (let i = 0; i < chunks.length; i += TransformersJsEmbeddingsProvider.maxGroupSize) {
            const chunkGroup = chunks.slice(i, i + TransformersJsEmbeddingsProvider.maxGroupSize);
            const output = await extractor(chunkGroup, {
                pooling: "mean",
                normalize: true,
            });
            // To avoid causing the extension host to go unresponsive
            await new Promise((resolve) => setTimeout(resolve, 10));
            outputs.push(...output.tolist());
        }
        return outputs;
    }
}
exports.TransformersJsEmbeddingsProvider = TransformersJsEmbeddingsProvider;
TransformersJsEmbeddingsProvider.providerName = "transformers.js";
TransformersJsEmbeddingsProvider.maxGroupSize = 1;
TransformersJsEmbeddingsProvider.model = "all-MiniLM-L6-v2";
TransformersJsEmbeddingsProvider.mockVector = Array.from({ length: 384 }).fill(2);
TransformersJsEmbeddingsProvider.defaultOptions = {
    model: TransformersJsEmbeddingsProvider.model,
};
exports.default = TransformersJsEmbeddingsProvider;
//# sourceMappingURL=TransformersJsEmbeddingsProvider.js.map