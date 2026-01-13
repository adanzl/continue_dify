"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextEditProvider = void 0;
const uuid_1 = require("uuid");
const OpenAI_js_1 = __importDefault(require("../llm/llms/OpenAI.js"));
const parameters_js_1 = require("../util/parameters.js");
const ContextRetrievalService_js_1 = require("../autocomplete/context/ContextRetrievalService.js");
const BracketMatchingService_js_1 = require("../autocomplete/filtering/BracketMatchingService.js");
const CompletionStreamer_js_1 = require("../autocomplete/generation/CompletionStreamer.js");
const index_js_1 = require("../autocomplete/postprocessing/index.js");
const index_js_2 = require("../autocomplete/prefiltering/index.js");
const index_js_3 = require("../autocomplete/snippets/index.js");
const ast_js_1 = require("../autocomplete/util/ast.js");
const AutocompleteDebouncer_js_1 = require("../autocomplete/util/AutocompleteDebouncer.js");
const AutocompleteLruCache_js_1 = __importDefault(require("../autocomplete/util/AutocompleteLruCache.js"));
const HelperVars_js_1 = require("../autocomplete/util/HelperVars.js");
const ignore_js_1 = require("../indexing/ignore.js");
const autodetect_js_1 = require("../llm/autodetect.js");
const pathToUri_js_1 = require("../util/pathToUri.js");
const aggregateEdits_js_1 = require("./context/aggregateEdits.js");
const diffFormatting_js_1 = require("./context/diffFormatting.js");
const DocumentHistoryTracker_js_1 = require("./DocumentHistoryTracker.js");
const NextEditLoggingService_js_1 = require("./NextEditLoggingService.js");
const NextEditPrefetchQueue_js_1 = require("./NextEditPrefetchQueue.js");
const NextEditProviderFactory_js_1 = require("./NextEditProviderFactory.js");
const autocompleteCache = AutocompleteLruCache_js_1.default.get();
// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
    // From Ollama
    "unexpected server status",
    "operation was aborted",
];
/**
 * This is the next edit analogue to autocomplete's CompletionProvider.
 * You will see a lot of similar if not identical methods to CompletionProvider methods.
 * All logic used to live inside this class, but that became untenable quickly.
 * I moved a lot of the model-specific logic (prompt building, pre/post processing, etc.) to the BaseNextEditProvider and the children inheriting from it.
 * Keeping this class around might be a good idea because it handles lots of delicate logic such as abort signals, chains, logging, etc.
 * There being a singleton also gives a lot of guarantees about the state of the next edit state machine.
 */
class NextEditProvider {
    constructor(configHandler, ide, _injectedGetLlm, _onError, getDefinitionsFromLsp, endpointType) {
        this.configHandler = configHandler;
        this.ide = ide;
        this._injectedGetLlm = _injectedGetLlm;
        this._onError = _onError;
        this.getDefinitionsFromLsp = getDefinitionsFromLsp;
        this.autocompleteCache = AutocompleteLruCache_js_1.default.get();
        this.errorsShown = new Set();
        this.bracketMatchingService = new BracketMatchingService_js_1.BracketMatchingService();
        this.debouncer = new AutocompleteDebouncer_js_1.AutocompleteDebouncer();
        this.diffContext = [];
        this.autocompleteContext = "";
        this.promptMetadata = null;
        this.currentEditChainId = null;
        this.previousRequest = null;
        this.previousCompletions = [];
        // Model-specific provider instance.
        this.modelProvider = null;
        this.completionStreamer = new CompletionStreamer_js_1.CompletionStreamer(this.onError.bind(this));
        this.contextRetrievalService = new ContextRetrievalService_js_1.ContextRetrievalService(this.ide);
        this.endpointType = endpointType;
        this.loggingService = NextEditLoggingService_js_1.NextEditLoggingService.getInstance();
    }
    static initialize(configHandler, ide, injectedGetLlm, onError, getDefinitionsFromLsp, endpointType) {
        if (!NextEditProvider.instance) {
            NextEditProvider.instance = new NextEditProvider(configHandler, ide, injectedGetLlm, onError, getDefinitionsFromLsp, endpointType);
        }
        return NextEditProvider.instance;
    }
    static getInstance() {
        if (!NextEditProvider.instance) {
            throw new Error("NextEditProvider has not been initialized. Call initialize() first.");
        }
        return NextEditProvider.instance;
    }
    addDiffToContext(diff) {
        this.diffContext.push(diff);
        if (this.diffContext.length > 5) {
            this.diffContext.shift();
        }
    }
    addAutocompleteContext(ctx) {
        this.autocompleteContext = ctx;
    }
    async _prepareLlm() {
        const llm = await this._injectedGetLlm();
        if (!llm) {
            return undefined;
        }
        // Temporary fix for JetBrains autocomplete bug as described in https://github.com/continuedev/continue/pull/3022
        if (llm.model === undefined && llm.completionOptions?.model !== undefined) {
            llm.model = llm.completionOptions.model;
        }
        // Ignore empty API keys for Mistral since we currently write
        // a template provider without one during onboarding
        if (llm.providerName === "mistral" && llm.apiKey === "") {
            return undefined;
        }
        // Set temperature (but don't override)
        if (llm.completionOptions.temperature === undefined) {
            llm.completionOptions.temperature = 0.01;
        }
        if (llm instanceof OpenAI_js_1.default) {
            llm.useLegacyCompletionsEndpoint = true;
        }
        // TODO: Resolve import error with TRIAL_FIM_MODEL
        // else if (
        //   llm.providerName === "free-trial" &&
        //   llm.model !== TRIAL_FIM_MODEL
        // ) {
        //   llm.model = TRIAL_FIM_MODEL;
        // }
        return llm;
    }
    onError(e) {
        if (ERRORS_TO_IGNORE.some((err) => typeof e === "string" ? e.includes(err) : e?.message?.includes(err))) {
            return;
        }
        console.warn("Error generating autocompletion: ", e);
        if (!this.errorsShown.has(e.message)) {
            this.errorsShown.add(e.message);
            this._onError(e);
        }
    }
    cancel() {
        this.loggingService.cancel();
    }
    accept(completionId) {
        const outcome = this.loggingService.accept(completionId);
        if (!outcome) {
            return;
        }
    }
    reject(completionId) {
        const outcome = this.loggingService.reject(completionId);
        if (!outcome) {
            return;
        }
    }
    markDisplayed(completionId, outcome) {
        this.loggingService.markDisplayed(completionId, outcome);
    }
    async _getAutocompleteOptions() {
        const { config } = await this.configHandler.loadConfig();
        const options = {
            ...parameters_js_1.DEFAULT_AUTOCOMPLETE_OPTS,
            ...config?.tabAutocompleteOptions,
        };
        return options;
    }
    chainExists() {
        return this.currentEditChainId !== null;
    }
    getChainLength() {
        return this.previousCompletions.length;
    }
    getPreviousCompletion() {
        return this.previousCompletions[0];
    }
    async deleteChain() {
        NextEditPrefetchQueue_js_1.PrefetchQueue.getInstance().abort();
        this.currentEditChainId = null;
        this.previousCompletions = [];
        if (this.previousRequest) {
            const fileContent = (await this.ide.readFile(this.previousRequest.filepath)).toString();
            const ast = await (0, ast_js_1.getAst)(this.previousRequest.filepath, fileContent);
            if (ast) {
                DocumentHistoryTracker_js_1.DocumentHistoryTracker.getInstance().push((0, pathToUri_js_1.localPathOrUriToPath)(this.previousRequest.filepath), fileContent, ast);
            }
        }
    }
    startChain(id) {
        this.currentEditChainId = id ?? (0, uuid_1.v4)();
    }
    getChain() {
        return this.previousCompletions;
    }
    isStartOfChain() {
        return this.previousCompletions.length === 1;
    }
    /**
     * This is the main entry point to this class.
     */
    async provideInlineCompletionItems(input, token, opts) {
        if ((0, ignore_js_1.isSecurityConcern)(input.filepath)) {
            return undefined;
        }
        try {
            this.previousRequest = input;
            const { token: abortToken, startTime, helper, } = await this._initializeCompletionRequest(input, token);
            if (!helper)
                return undefined;
            // Create model-specific provider based on the model name.
            this.modelProvider = NextEditProviderFactory_js_1.NextEditProviderFactory.createProvider(helper.modelName);
            const { editableRegionStartLine, editableRegionEndLine, prompts } = await this._generatePrompts(helper, opts);
            return await this._handleCompletion(helper, prompts, abortToken, startTime, editableRegionStartLine, editableRegionEndLine, opts);
        }
        catch (e) {
            this.onError(e);
        }
        finally {
            this.loggingService.deleteAbortController(input.completionId);
        }
    }
    async _initializeCompletionRequest(input, token) {
        // Create abort signal if not given
        if (!token) {
            const controller = this.loggingService.createAbortController(input.completionId);
            token = controller.signal;
        }
        else {
            // Token was provided externally, just track the completion.
            this.loggingService.trackPendingCompletion(input.completionId);
        }
        const startTime = Date.now();
        const options = await this._getAutocompleteOptions();
        // Debounce
        if (await this.debouncer.delayAndShouldDebounce(options.debounceDelay)) {
            return { token, startTime, helper: undefined };
        }
        const llm = await this._prepareLlm();
        if (!llm) {
            return { token, startTime, helper: undefined };
        }
        // Update pending completion with model info.
        this.loggingService.updatePendingCompletion(input.completionId, {
            modelName: llm.model,
            modelProvider: llm.providerName,
            filepath: input.filepath,
        });
        // Check model capabilities
        if (!(0, autodetect_js_1.modelSupportsNextEdit)(llm.capabilities, llm.model, llm.title)) {
            console.error(`${llm.model} is not capable of next edit.`);
            return { token, startTime, helper: undefined };
        }
        if (llm.promptTemplates?.autocomplete) {
            options.template = llm.promptTemplates.autocomplete;
        }
        const helper = await HelperVars_js_1.HelperVars.create(input, options, llm.model, this.ide);
        if (await (0, index_js_2.shouldPrefilter)(helper, this.ide)) {
            return { token, startTime, helper: undefined };
        }
        return { token, startTime, helper };
    }
    async _generatePrompts(helper, opts) {
        if (!this.modelProvider) {
            throw new Error("Model provider not initialized");
        }
        // NOTE: getAllSnippetsWithoutRace doesn't seem to incur much performance penalties when compared to getAllSnippets.
        // Use getAllSnippets if snippet gathering becomes noticably slow.
        const [snippetPayload, workspaceDirs] = await Promise.all([
            (0, index_js_3.getAllSnippetsWithoutRace)({
                helper,
                ide: this.ide,
                getDefinitionsFromLsp: this.getDefinitionsFromLsp,
                contextRetrievalService: this.contextRetrievalService,
            }),
            this.ide.getWorkspaceDirs(),
        ]);
        // Calculate editable region based on model and options.
        const { editableRegionStartLine, editableRegionEndLine } = this.modelProvider.calculateEditableRegion(helper, opts?.usingFullFileDiff ?? false);
        // Build diffContext including in-progress edits
        // The finalized diffs are in this.diffContext, but we also need to include
        // any in-progress edits that haven't been finalized yet (the user's most recent typing)
        const combinedDiffContext = [...this.diffContext];
        try {
            const inProgressDiff = aggregateEdits_js_1.EditAggregator.getInstance().getInProgressDiff(helper.filepath);
            if (inProgressDiff) {
                combinedDiffContext.push(inProgressDiff);
            }
        }
        catch (e) {
            // EditAggregator may not be initialized yet, ignore
        }
        // Build context for model-specific prompt generation.
        const context = {
            helper,
            snippetPayload,
            editableRegionStartLine,
            editableRegionEndLine,
            diffContext: combinedDiffContext,
            autocompleteContext: this.autocompleteContext,
            historyDiff: (0, diffFormatting_js_1.createDiff)({
                beforeContent: DocumentHistoryTracker_js_1.DocumentHistoryTracker.getInstance().getMostRecentDocumentHistory((0, pathToUri_js_1.localPathOrUriToPath)(helper.filepath)) ?? "",
                afterContent: helper.fileContents,
                filePath: helper.filepath,
                diffType: diffFormatting_js_1.DiffFormatType.Unified,
                contextLines: 3,
                workspaceDir: workspaceDirs[0], // Use first workspace directory
            }),
        };
        const prompts = await this.modelProvider.generatePrompts(context);
        this.promptMetadata = this.modelProvider.buildPromptMetadata(context);
        return { editableRegionStartLine, editableRegionEndLine, prompts };
    }
    async _handleCompletion(helper, prompts, token, startTime, editableRegionStartLine, editableRegionEndLine, opts) {
        if (!this.modelProvider) {
            throw new Error("Model provider not initialized");
        }
        const llm = await this._prepareLlm();
        if (!llm)
            return undefined;
        // Inject unique token if needed (for Mercury models).
        if (this.modelProvider.shouldInjectUniqueToken()) {
            const uniqueToken = this.modelProvider.getUniqueToken();
            if (uniqueToken) {
                const lastPrompt = prompts[prompts.length - 1];
                if (lastPrompt && typeof lastPrompt.content === "string") {
                    lastPrompt.content += uniqueToken;
                }
            }
        }
        // Send prompts to LLM (using only user prompt for fine-tuned models).
        // prompts[1] extracts the user prompt from the system-user prompt pair.
        // NOTE: Stream is currently set to false, but this should ideally be a per-model flag.
        // Mercury Coder currently does not support streaming.
        const msg = await llm.chat(this.endpointType === "fineTuned" ? [prompts[1]] : prompts, token, {
            stream: false,
        });
        if (typeof msg.content !== "string") {
            return undefined;
        }
        // Extract completion using model-specific logic.
        let nextCompletion = this.modelProvider.extractCompletion(msg.content);
        // Postprocess the completion (same as autocomplete).
        const postprocessed = (0, index_js_1.postprocessCompletion)({
            completion: nextCompletion,
            llm,
            prefix: helper.prunedPrefix,
            suffix: helper.prunedSuffix,
        });
        // Return early if postprocessing filtered out the completion.
        if (!postprocessed) {
            return undefined;
        }
        nextCompletion = postprocessed;
        let outcome;
        // Handle based on diff type.
        const profileType = this.configHandler.currentProfile?.profileDescription.profileType;
        if (opts?.usingFullFileDiff === false || !opts?.usingFullFileDiff) {
            outcome = await this.modelProvider.handlePartialFileDiff({
                helper,
                editableRegionStartLine,
                editableRegionEndLine,
                startTime,
                llm,
                nextCompletion,
                promptMetadata: this.promptMetadata,
                ide: this.ide,
                profileType,
            });
        }
        else {
            outcome = await this.modelProvider.handleFullFileDiff({
                helper,
                editableRegionStartLine,
                editableRegionEndLine,
                startTime,
                llm,
                nextCompletion,
                promptMetadata: this.promptMetadata,
                ide: this.ide,
                profileType,
            });
        }
        if (outcome) {
            // Handle NextEditProvider-specific state.
            this.previousCompletions.push(outcome);
            // Mark as displayed for JetBrains
            await this._markDisplayedIfJetBrains(helper.input.completionId, outcome);
        }
        return outcome;
    }
    async _markDisplayedIfJetBrains(completionId, outcome) {
        const ideType = (await this.ide.getIdeInfo()).ideType;
        if (ideType === "jetbrains") {
            this.markDisplayed(completionId, outcome);
        }
    }
    /**
     * This is a wrapper around provideInlineCompletionItems.
     * This is invoked when we call the model in the background using prefetch.
     * It's not currently used anywhere (references are not used either), but I decided to keep it in case we actually need to use prefetch.
     * You will see that calls to this method is made from NextEditPrefetchQueue.proecss(), which is wrapped in `if (!this.usingFullFileDiff)`.
     */
    async provideInlineCompletionItemsWithChain(ctx, nextEditLocation, token, usingFullFileDiff) {
        try {
            const previousOutcome = this.getPreviousCompletion();
            if (!previousOutcome) {
                console.log("previousOutcome is undefined");
                return undefined;
            }
            // Use the frontmost RangeInFile to build an input.
            const input = this.buildAutocompleteInputFromChain(previousOutcome, nextEditLocation, ctx);
            if (!input) {
                console.log("input is undefined");
                return undefined;
            }
            return await this.provideInlineCompletionItems(input, token, {
                withChain: true,
                usingFullFileDiff,
            });
        }
        catch (e) {
            this.onError(e);
        }
    }
    buildAutocompleteInputFromChain(previousOutcome, nextEditableRegion, ctx) {
        const input = {
            pos: {
                line: nextEditableRegion.range.start.line,
                character: nextEditableRegion.range.start.character,
            },
            filepath: previousOutcome.fileUri,
            ...ctx,
        };
        return input;
    }
}
exports.NextEditProvider = NextEditProvider;
NextEditProvider.instance = null;
//# sourceMappingURL=NextEditProvider.js.map