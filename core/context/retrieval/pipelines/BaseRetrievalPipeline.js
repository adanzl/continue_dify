"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const wink_nlp_utils_1 = __importDefault(require("wink-nlp-utils"));
const openedFilesLruCache_1 = require("../../../autocomplete/util/openedFilesLruCache");
const chunk_1 = require("../../../indexing/chunk/chunk");
const FullTextSearchCodebaseIndex_1 = require("../../../indexing/FullTextSearchCodebaseIndex");
const LanceDbIndex_1 = require("../../../indexing/LanceDbIndex");
const builtIn_1 = require("../../../tools/builtIn");
const callTool_1 = require("../../../tools/callTool");
const globSearch_1 = require("../../../tools/definitions/globSearch");
const grepSearch_1 = require("../../../tools/definitions/grepSearch");
const ls_1 = require("../../../tools/definitions/ls");
const readFile_1 = require("../../../tools/definitions/readFile");
const viewRepoMap_1 = require("../../../tools/definitions/viewRepoMap");
const viewSubdirectory_1 = require("../../../tools/definitions/viewSubdirectory");
const DEFAULT_CHUNK_SIZE = 384;
const AVAILABLE_TOOLS = [
    globSearch_1.globSearchTool,
    grepSearch_1.grepSearchTool,
    ls_1.lsTool,
    readFile_1.readFileTool,
    viewRepoMap_1.viewRepoMapTool,
    viewSubdirectory_1.viewSubdirectoryTool,
];
class BaseRetrievalPipeline {
    constructor(options) {
        this.options = options;
        this.ftsIndex = new FullTextSearchCodebaseIndex_1.FullTextSearchCodebaseIndex();
        this.lanceDbIndex = null;
        this.lanceDbInitPromise = null;
        void this.initLanceDb();
    }
    async initLanceDb() {
        const embedModel = this.options.config.selectedModelByRole.embed;
        if (!embedModel) {
            return;
        }
        this.lanceDbIndex = await LanceDbIndex_1.LanceDbIndex.create(embedModel, (uri) => this.options.ide.readFile(uri));
    }
    async ensureLanceDbInitialized() {
        if (this.lanceDbIndex) {
            return true;
        }
        if (this.lanceDbInitPromise) {
            await this.lanceDbInitPromise;
            return this.lanceDbIndex !== null;
        }
        this.lanceDbInitPromise = this.initLanceDb();
        await this.lanceDbInitPromise;
        this.lanceDbInitPromise = null; // clear after init
        return this.lanceDbIndex !== null;
    }
    getCleanedTrigrams(query) {
        let text = wink_nlp_utils_1.default.string.removeExtraSpaces(query);
        text = wink_nlp_utils_1.default.string.stem(text);
        let tokens = wink_nlp_utils_1.default.string
            .tokenize(text, true)
            .filter((token) => token.tag === "word")
            .map((token) => token.value);
        tokens = wink_nlp_utils_1.default.tokens.removeWords(tokens);
        tokens = wink_nlp_utils_1.default.tokens.setOfWords(tokens);
        const cleanedTokens = [...tokens].join(" ");
        const trigrams = wink_nlp_utils_1.default.string.ngram(cleanedTokens, 3);
        return trigrams.map(this.escapeFtsQueryString);
    }
    escapeFtsQueryString(query) {
        const escapedDoubleQuotes = query.replace(/"/g, '""');
        return `"${escapedDoubleQuotes}"`;
    }
    async retrieveFts(args, n) {
        if (args.query.trim() === "") {
            return [];
        }
        const tokens = this.getCleanedTrigrams(args.query).join(" OR ");
        return await this.ftsIndex.retrieve({
            n,
            text: tokens,
            tags: args.tags,
            directory: args.filterDirectory,
        });
    }
    async retrieveAndChunkRecentlyEditedFiles(n) {
        const recentlyEditedFilesSlice = Array.from(openedFilesLruCache_1.openedFilesLruCache.keys()).slice(0, n);
        // If the number of recently edited files is less than the retrieval limit,
        // include additional open files. This is useful in the case where a user
        // has many tabs open and reloads their IDE. They now have 0 recently edited files,
        // but many open tabs that represent what they were working on prior to reload.
        if (recentlyEditedFilesSlice.length < n) {
            const openFiles = await this.options.ide.getOpenFiles();
            recentlyEditedFilesSlice.push(...openFiles.slice(0, n - recentlyEditedFilesSlice.length));
        }
        const chunks = [];
        for (const filepath of recentlyEditedFilesSlice) {
            const contents = await this.options.ide.readFile(filepath);
            const fileChunks = (0, chunk_1.chunkDocument)({
                filepath,
                contents,
                maxChunkSize: this.options.config.selectedModelByRole.embed
                    ?.maxEmbeddingChunkSize ?? DEFAULT_CHUNK_SIZE,
                digest: filepath,
            });
            for await (const chunk of fileChunks) {
                chunks.push(chunk);
            }
        }
        return chunks.slice(0, n);
    }
    async retrieveEmbeddings(input, n) {
        const initialized = await this.ensureLanceDbInitialized();
        if (!initialized || !this.lanceDbIndex) {
            console.warn("LanceDB index not available, skipping embeddings retrieval");
            return [];
        }
        return this.lanceDbIndex.retrieve(input, n, this.options.tags, this.options.filterDirectory);
    }
    run(args) {
        throw new Error("Not implemented");
    }
    async retrieveWithTools(input) {
        const toolSelectionPrompt = `Given the following user input: "${input}"

Available tools:
${AVAILABLE_TOOLS.map((tool) => {
            const requiredParams = tool.function.parameters?.required || [];
            const properties = tool.function.parameters?.properties || {};
            const paramDescriptions = requiredParams
                .map((param) => `${param}: ${properties[param]?.description || "string"}`)
                .join(", ");
            return `- ${tool.function.name}: ${tool.function.description}
  Required arguments: ${paramDescriptions || "none"}`;
        }).join("\n")}

Determine which tools should be used to answer this query. You should feel free to use multiple tools when they would be helpful for comprehensive results. Respond ONLY a JSON object containing the following and nothing else:
{
  "tools": [
    {
      "name": "<tool_name>",
      "args": { "<required_parameter_name>": "<required_parameter_value>" }
    }
  ]
}`;
        // Get LLM response for tool selection
        const toolSelectionResponse = await this.options.llm.chat([{ role: "user", content: toolSelectionPrompt }], new AbortController().signal);
        let toolCalls = [];
        try {
            const responseContent = typeof toolSelectionResponse.content === "string"
                ? toolSelectionResponse.content
                : toolSelectionResponse.content
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("");
            const parsed = JSON.parse(responseContent);
            toolCalls = parsed.tools || [];
        }
        catch (e) {
            console.log(`Failed to parse tool selection response: ${toolSelectionResponse.content}\n\n`, e);
            return [];
        }
        // Execute tools and collect results
        const allContextItems = [];
        const toolExtras = {
            ide: this.options.ide,
            llm: this.options.llm,
            fetch: fetch,
            tool: grepSearch_1.grepSearchTool,
            config: this.options.config,
        };
        for (const toolCall of toolCalls) {
            const tool = AVAILABLE_TOOLS.find((t) => t.function.name === toolCall.name);
            const args = toolCall.args;
            if (toolCall.name === builtIn_1.BuiltInToolNames.GrepSearch) {
                args.splitByFile = true;
            }
            toolExtras.tool = tool;
            const contextItems = await (0, callTool_1.callBuiltInTool)(toolCall.name, args, toolExtras);
            allContextItems.push(...contextItems);
        }
        const chunks = [];
        // Transform ContextItem[] to Chunk[]
        for (let i = 0; i < allContextItems.length; i++) {
            const contextItem = allContextItems[i];
            const filepath = contextItem.uri?.value || contextItem.name || "unknown";
            const cleanedFilepath = filepath.replace(/^file:\/\/\//, "");
            chunks.push({
                content: contextItem.content,
                startLine: -1,
                endLine: -1,
                digest: `file:///${cleanedFilepath}`,
                filepath: `file:///${cleanedFilepath}`,
                index: i,
            });
        }
        console.log("retrieveWithTools chunks", chunks);
        return chunks;
    }
}
exports.default = BaseRetrievalPipeline;
//# sourceMappingURL=BaseRetrievalPipeline.js.map