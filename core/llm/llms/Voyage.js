"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const OpenAI_js_1 = __importDefault(require("./OpenAI.js"));
/**used to check a valid response from voyage is received
 * reference: https://docs.voyageai.com/reference/reranker-api
 */
const VoyageRerankSuccessResponseSchema = zod_1.z.object({
    data: zod_1.z.array(zod_1.z.object({
        index: zod_1.z.number(),
        relevance_score: zod_1.z.number(),
        document: zod_1.z.string(),
    })),
});
class Voyage extends OpenAI_js_1.default {
    async rerank(query, chunks) {
        if (!query || chunks.length === 0) {
            return [];
        }
        const url = new URL("rerank", this.apiBase);
        const resp = await this.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                query,
                documents: chunks.map((chunk) => chunk.content),
                model: this.model ?? "rerank-2",
            }),
        });
        if (resp.status !== 200) {
            throw new Error(`VoyageReranker API error ${resp.status}: ${await resp.text()}`);
        }
        const data = (await resp.json());
        const parsedData = VoyageRerankSuccessResponseSchema.parse(data);
        const results = parsedData.data.sort((a, b) => a.index - b.index);
        return results.map((result) => result.relevance_score);
    }
}
Voyage.providerName = "voyage";
Voyage.defaultOptions = {
    apiBase: "https://api.voyageai.com/v1/",
    maxEmbeddingBatchSize: 128,
};
exports.default = Voyage;
//# sourceMappingURL=Voyage.js.map