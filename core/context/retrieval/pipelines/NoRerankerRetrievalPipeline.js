"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const posthog_1 = require("../../../util/posthog");
const uri_1 = require("../../../util/uri");
const repoMapRequest_1 = require("../repoMapRequest");
const util_1 = require("../util");
const BaseRetrievalPipeline_1 = __importDefault(require("./BaseRetrievalPipeline"));
class NoRerankerRetrievalPipeline extends BaseRetrievalPipeline_1.default {
    async run(args) {
        const { input, nFinal, filterDirectory, config } = this.options;
        // We give 1/4 weight to recently edited files, 1/4 to full text search,
        // and the remaining 1/2 to embeddings
        const recentlyEditedNFinal = nFinal * 0.25;
        const ftsNFinal = nFinal * 0.25;
        const embeddingsNFinal = nFinal - recentlyEditedNFinal - ftsNFinal;
        let retrievalResults = [];
        let ftsChunks = [];
        try {
            ftsChunks = await this.retrieveFts(args, ftsNFinal);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("no_reranker_fts_retrieval", error);
            // console.error("Error retrieving FTS chunks:", error);
        }
        let embeddingsChunks = [];
        try {
            embeddingsChunks = !!config.selectedModelByRole.embed
                ? await this.retrieveEmbeddings(input, embeddingsNFinal)
                : [];
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("no_reranker_embeddings_retrieval", error);
            console.error("Error retrieving embeddings:", error);
        }
        let recentlyEditedFilesChunks = [];
        try {
            recentlyEditedFilesChunks =
                await this.retrieveAndChunkRecentlyEditedFiles(recentlyEditedNFinal);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("no_reranker_recently_edited_retrieval", error);
            console.error("Error retrieving recently edited files:", error);
        }
        let repoMapChunks = [];
        try {
            repoMapChunks = await (0, repoMapRequest_1.requestFilesFromRepoMap)(this.options.llm, this.options.config, this.options.ide, input, filterDirectory);
        }
        catch (error) {
            await posthog_1.Telemetry.captureError("no_reranker_repo_map_retrieval", error);
            console.error("Error retrieving repo map chunks:", error);
        }
        if (this.options.config.experimental?.codebaseToolCallingOnly) {
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
}
exports.default = NoRerankerRetrievalPipeline;
//# sourceMappingURL=NoRerankerRetrievalPipeline.js.map