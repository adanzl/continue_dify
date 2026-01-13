"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parameters_1 = require("../../../util/parameters");
const posthog_1 = require("../../../util/posthog");
const uri_1 = require("../../../util/uri");
const repoMapRequest_1 = require("../repoMapRequest");
const util_1 = require("../util");
const BaseRetrievalPipeline_1 = __importDefault(require("./BaseRetrievalPipeline"));
class RerankerRetrievalPipeline extends BaseRetrievalPipeline_1.default {
    async _retrieveInitial(args) {
        const { input, nRetrieve, filterDirectory, config } = this.options;
        let retrievalResults = [];
        let ftsChunks = [];
        try {
            ftsChunks = await this.retrieveFts(args, nRetrieve);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("reranker_fts_retrieval", error);
            // console.error("Error retrieving FTS chunks:", error);
        }
        let embeddingsChunks = [];
        try {
            embeddingsChunks = Boolean(config.selectedModelByRole.embed)
                ? await this.retrieveEmbeddings(input, nRetrieve)
                : [];
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("reranker_embeddings_retrieval", error);
            console.error("Error retrieving embeddings chunks:", error);
        }
        let recentlyEditedFilesChunks = [];
        try {
            recentlyEditedFilesChunks =
                await this.retrieveAndChunkRecentlyEditedFiles(nRetrieve);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("reranker_recently_edited_retrieval", error);
            console.error("Error retrieving recently edited files chunks:", error);
        }
        let repoMapChunks = [];
        try {
            repoMapChunks = await (0, repoMapRequest_1.requestFilesFromRepoMap)(this.options.llm, this.options.config, this.options.ide, input, filterDirectory);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("reranker_repo_map_retrieval", error);
            console.error("Error retrieving repo map chunks:", error);
        }
        if (config.experimental?.codebaseToolCallingOnly) {
            let toolBasedChunks = [];
            try {
                toolBasedChunks = await this.retrieveWithTools(input);
            }
            catch (error) {
                console.error("Error retrieving tool based chunks:", error);
            }
            retrievalResults.push(...toolBasedChunks);
        }
        else {
            retrievalResults.push(...recentlyEditedFilesChunks, ...ftsChunks, ...embeddingsChunks, ...repoMapChunks);
        }
        if (filterDirectory) {
            // Backup if the individual retrieval methods don't listen
            retrievalResults = retrievalResults.filter((chunk) => !!(0, uri_1.findUriInDirs)(chunk.filepath, [filterDirectory]).foundInDir);
        }
        const deduplicatedRetrievalResults = (0, util_1.deduplicateChunks)(retrievalResults);
        return deduplicatedRetrievalResults;
    }
    async _rerank(input, chunks) {
        if (!this.options.config.selectedModelByRole.rerank) {
            throw new Error("No reranker set up");
        }
        // remove empty chunks -- some APIs fail on that
        chunks = chunks.filter((chunk) => chunk.content);
        try {
            let scores = await this.options.config.selectedModelByRole.rerank.rerank(input, chunks);
            // Filter out low-scoring results
            let results = chunks;
            // let results = chunks.filter(
            //   (_, i) => scores[i] >= RETRIEVAL_PARAMS.rerankThreshold,
            // );
            // scores = scores.filter(
            //   (score) => score >= RETRIEVAL_PARAMS.rerankThreshold,
            // );
            const chunkIndexMap = new Map();
            chunks.forEach((chunk, idx) => chunkIndexMap.set(chunk, idx));
            results?.sort((a, b) => scores[chunkIndexMap.get(b)] - scores[chunkIndexMap.get(a)]);
            results = results.slice(0, this.options.nFinal);
            return results;
        }
        catch (e) {
            console.warn(`Failed to rerank retrieval results\n${e}`);
            return chunks.slice(0, this.options.nFinal);
        }
    }
    async _expandWithEmbeddings(chunks) {
        const topResults = chunks.slice(-parameters_1.RETRIEVAL_PARAMS.nResultsToExpandWithEmbeddings);
        const expanded = await Promise.all(topResults.map(async (chunk, i) => {
            const results = await this.retrieveEmbeddings(chunk.content, parameters_1.RETRIEVAL_PARAMS.nEmbeddingsExpandTo);
            return results;
        }));
        return expanded.flat();
    }
    async _expandRankedResults(chunks) {
        let results = [];
        const embeddingsResults = await this._expandWithEmbeddings(chunks);
        results.push(...embeddingsResults);
        return results;
    }
    async run(args) {
        let results = await this._retrieveInitial(args);
        results = await this._rerank(args.query, results);
        // // // Expand top reranked results
        // const expanded = await this._expandRankedResults(results);
        // results.push(...expanded);
        // // De-duplicate
        // results = deduplicateChunks(results);
        // // Rerank again
        // results = await this._rerank(input, results);
        // TODO: stitch together results
        return results;
    }
}
exports.default = RerankerRetrievalPipeline;
// Source: expansion with code graph
// consider doing this after reranking? Or just having a lower reranking threshold
// This is VS Code only until we use PSI for JetBrains or build our own general solution
// TODO: Need to pass in the expandSnippet function as a function argument
// because this import causes `tsc` to fail
// if ((await extras.ide.getIdeInfo()).ideType === "vscode") {
//   const { expandSnippet } = await import(
//     "../../../extensions/vscode/src/util/expandSnippet"
//   );
//   let expansionResults = (
//     await Promise.all(
//       extras.selectedCode.map(async (rif) => {
//         return expandSnippet(
//           rif.filepath,
//           rif.range.start.line,
//           rif.range.end.line,
//           extras.ide,
//         );
//       }),
//     )
//   ).flat() as Chunk[];
//   retrievalResults.push(...expansionResults);
// }
// Source: Open file exact match
// Source: Class/function name exact match
//# sourceMappingURL=RerankerRetrievalPipeline.js.map