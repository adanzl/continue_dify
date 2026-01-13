"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class HuggingFaceTEIEmbeddingsProvider extends index_js_1.BaseLLM {
    constructor(options) {
        super(options);
        this.doInfoRequest()
            .then((response) => {
            this.model = response.model_id;
            this.maxEmbeddingBatchSize = response.max_client_batch_size;
        })
            .catch((error) => {
            console.error("Failed to fetch info from HuggingFace TEI Embeddings Provider:", error);
        });
    }
    async _embed(batch) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }
        const resp = await this.fetch(new URL("embed", this.apiBase), {
            method: "POST",
            body: JSON.stringify({
                inputs: batch,
            }),
            headers,
        });
        if (!resp.ok) {
            const text = await resp.text();
            let teiError = null;
            try {
                teiError = JSON.parse(text);
            }
            catch (e) {
                console.log(`Failed to parse TEI embed error response:\n${text}`, e);
            }
            if (teiError && (teiError.error_type || teiError.error)) {
                throw new TEIEmbedError(teiError);
            }
            throw new Error(text);
        }
        return (await resp.json());
    }
    async doInfoRequest() {
        // TODO - need to use custom fetch for this request?
        const resp = await this.fetch(new URL("info", this.apiBase), {
            method: "GET",
        });
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        return (await resp.json());
    }
    async rerank(query, chunks) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }
        const resp = await this.fetch(new URL("rerank", this.apiBase), {
            method: "POST",
            headers,
            body: JSON.stringify({
                query: query,
                return_text: false,
                raw_scores: false,
                texts: chunks.map((chunk) => chunk.content),
                truncation_direction: "Right",
                truncate: true,
            }),
        });
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const data = (await resp.json());
        // Resort into original order and extract scores
        const results = data.sort((a, b) => a.index - b.index);
        return results.map((result) => result.score);
    }
}
HuggingFaceTEIEmbeddingsProvider.providerName = "huggingface-tei";
HuggingFaceTEIEmbeddingsProvider.defaultOptions = {
    apiBase: "http://localhost:8080",
    model: "tei",
};
class TEIEmbedError extends Error {
    constructor(teiResponse) {
        super(JSON.stringify(teiResponse));
    }
}
exports.default = HuggingFaceTEIEmbeddingsProvider;
//# sourceMappingURL=HuggingFaceTEI.js.map