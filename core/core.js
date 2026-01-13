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
exports.Core = void 0;
const fetch_1 = require("@continuedev/fetch");
const URI = __importStar(require("uri-js"));
const uuid_1 = require("uuid");
const CompletionProvider_1 = require("./autocomplete/CompletionProvider");
const openedFilesLruCache_1 = require("./autocomplete/util/openedFilesLruCache");
const ConfigHandler_1 = require("./config/ConfigHandler");
const util_1 = require("./config/util");
const index_1 = require("./control-plane/auth/index");
const env_1 = require("./control-plane/env");
const devdataSqlite_1 = require("./data/devdataSqlite");
const log_1 = require("./data/log");
const CodebaseIndexer_1 = require("./indexing/CodebaseIndexer");
const DocsService_1 = __importDefault(require("./indexing/docs/DocsService"));
const countTokens_1 = require("./llm/countTokens");
const Lemonade_1 = __importDefault(require("./llm/llms/Lemonade"));
const Ollama_1 = __importDefault(require("./llm/llms/Ollama"));
const aggregateEdits_1 = require("./nextEdit/context/aggregateEdits");
const createNewPromptFile_1 = require("./promptFiles/createNewPromptFile");
const callTool_1 = require("./tools/callTool");
const chatDescriber_1 = require("./util/chatDescriber");
const conversationCompaction_1 = require("./util/conversationCompaction");
const GlobalContext_1 = require("./util/GlobalContext");
const history_1 = __importDefault(require("./util/history"));
const paths_1 = require("./util/paths");
const posthog_1 = require("./util/posthog");
const processTerminalStates_1 = require("./util/processTerminalStates");
const treeSitter_1 = require("./util/treeSitter");
const tts_1 = require("./util/tts");
const gitDiffCache_1 = require("./autocomplete/snippets/gitDiffCache");
const mcpSlashCommand_1 = require("./commands/slash/mcpSlashCommand");
const createNewAssistantFile_1 = require("./config/createNewAssistantFile");
const loadLocalAssistants_1 = require("./config/loadLocalAssistants");
const loadCodebaseRules_1 = require("./config/markdown/loadCodebaseRules");
const onboarding_1 = require("./config/onboarding");
const workspaceBlocks_1 = require("./config/workspace/workspaceBlocks");
const MCPManagerSingleton_1 = require("./context/mcp/MCPManagerSingleton");
const MCPOauth_1 = require("./context/mcp/MCPOauth");
const mdm_1 = require("./control-plane/mdm/mdm");
const myers_1 = require("./diff/myers");
const applyAbortManager_1 = require("./edit/applyAbortManager");
const streamDiffLines_1 = require("./edit/streamDiffLines");
const shouldIgnore_1 = require("./indexing/shouldIgnore");
const walkDir_1 = require("./indexing/walkDir");
const logger_1 = require("./llm/logger");
const streamChat_1 = require("./llm/streamChat");
const processSmallEdit_1 = require("./nextEdit/context/processSmallEdit");
const NextEditPrefetchQueue_1 = require("./nextEdit/NextEditPrefetchQueue");
const NextEditProvider_1 = require("./nextEdit/NextEditProvider");
const core_1 = require("./protocol/core");
const errors_1 = require("./util/errors");
const historyUtils_1 = require("./util/historyUtils");
const Logger_js_1 = require("./util/Logger.js");
class Core {
    addMessageAbortController(id) {
        const controller = new AbortController();
        this.messageAbortControllers.set(id, controller);
        controller.signal.addEventListener("abort", () => {
            this.messageAbortControllers.delete(id);
        });
        return controller;
    }
    abortById(messageId) {
        this.messageAbortControllers.get(messageId)?.abort();
    }
    invoke(messageType, data) {
        return this.messenger.invoke(messageType, data);
    }
    send(messageType, data, messageId) {
        return this.messenger.send(messageType, data, messageId);
    }
    // TODO: It shouldn't actually need an IDE type, because this can happen
    // through the messenger (it does in the case of any non-VS Code IDEs already)
    constructor(messenger, ide) {
        this.messenger = messenger;
        this.ide = ide;
        this.globalContext = new GlobalContext_1.GlobalContext();
        this.llmLogger = new logger_1.LLMLogger();
        this.messageAbortControllers = new Map();
        this.getContextItems = async (msg) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config) {
                return [];
            }
            const { name, query, fullInput, selectedCode } = msg.data;
            const llm = (await this.configHandler.loadConfig()).config
                ?.selectedModelByRole.chat;
            if (!llm) {
                throw new Error("No chat model selected");
            }
            const provider = config.contextProviders?.find((provider) => provider.description.title === name);
            if (!provider) {
                return [];
            }
            try {
                void posthog_1.Telemetry.capture("context_provider_get_context_items", {
                    name: provider.description.title,
                });
                const items = await provider.getContextItems(query, {
                    config,
                    llm,
                    embeddingsProvider: config.selectedModelByRole.embed,
                    fullInput,
                    ide: this.ide,
                    selectedCode,
                    reranker: config.selectedModelByRole.rerank,
                    fetch: (url, init) => 
                    // Important note: context providers fetch uses global request options not LLM request options
                    // Because LLM calls are handled separately
                    (0, fetch_1.fetchwithRequestOptions)(url, init, config.requestOptions),
                    isInAgentMode: msg.data.isInAgentMode,
                });
                void posthog_1.Telemetry.capture("useContextProvider", {
                    name: provider.description.title,
                }, true);
                return items.map((item) => {
                    const id = {
                        providerTitle: provider.description.title,
                        itemId: (0, uuid_1.v4)(),
                    };
                    return { ...item, id };
                });
            }
            catch (e) {
                let knownError = false;
                if (e instanceof Error) {
                    // After removing transformers JS embeddings provider from jetbrains
                    // Should no longer see this error
                    // if (e.message.toLowerCase().includes("embeddings provider")) {
                    //   knownError = true;
                    //   const toastOption = "See Docs";
                    //   void this.ide
                    //     .showToast(
                    //       "error",
                    //       `Set up an embeddings model to use @${name}`,
                    //       toastOption,
                    //     )
                    //     .then((userSelection) => {
                    //       if (userSelection === toastOption) {
                    //         void this.ide.openUrl(
                    //           "https://docs.continue.dev/customize/model-roles/embeddings",
                    //         );
                    //       }
                    //     });
                    // }
                }
                if (!knownError) {
                    void this.ide.showToast("error", `Error getting context items from ${name}: ${e}`);
                }
                return [];
            }
        };
        try {
            // Ensure .continue directory is created
            (0, paths_1.migrateV1DevDataFiles)();
            const ideInfoPromise = messenger.request("getIdeInfo", undefined);
            const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
            const initialSessionInfoPromise = messenger.request("getControlPlaneSessionInfo", {
                silent: true,
                useOnboarding: false,
            });
            this.configHandler = new ConfigHandler_1.ConfigHandler(this.ide, this.llmLogger, initialSessionInfoPromise);
            this.docsService = DocsService_1.default.createSingleton(this.configHandler, this.ide, this.messenger);
            MCPManagerSingleton_1.MCPManagerSingleton.getInstance().onConnectionsRefreshed = () => {
                void this.configHandler.reloadConfig("MCP Connections refreshed");
                // Refresh @mention dropdown submenu items for MCP providers
                const mcpManager = MCPManagerSingleton_1.MCPManagerSingleton.getInstance();
                const mcpProviderNames = Array.from(mcpManager.connections.keys()).map((mcpId) => `mcp-${mcpId}`);
                if (mcpProviderNames.length > 0) {
                    this.messenger.send("refreshSubmenuItems", {
                        providers: mcpProviderNames,
                    });
                }
            };
            this.codeBaseIndexer = new CodebaseIndexer_1.CodebaseIndexer(this.configHandler, this.ide, this.messenger, this.globalContext.get("indexingPaused"));
            this.configHandler.onConfigUpdate((result) => {
                void (async () => {
                    const serializedResult = await this.configHandler.getSerializedConfig();
                    this.messenger.send("configUpdate", {
                        result: serializedResult,
                        profileId: this.configHandler.currentProfile?.profileDescription.id || null,
                        organizations: this.configHandler.getSerializedOrgs(),
                        selectedOrgId: this.configHandler.currentOrg?.id ?? null,
                    });
                    if (await this.codeBaseIndexer.wasAnyOneIndexAdded()) {
                        await this.codeBaseIndexer.refreshCodebaseIndex(await this.ide.getWorkspaceDirs());
                    }
                    // update additional submenu context providers registered via VSCode API
                    const additionalProviders = this.configHandler.getAdditionalSubmenuContextProviders();
                    if (additionalProviders.length > 0) {
                        this.messenger.send("refreshSubmenuItems", {
                            providers: additionalProviders,
                        });
                    }
                })();
            });
            // Dev Data Logger
            const dataLogger = log_1.DataLogger.getInstance();
            dataLogger.core = this;
            dataLogger.ideInfoPromise = ideInfoPromise;
            dataLogger.ideSettingsPromise = ideSettingsPromise;
            void ideSettingsPromise.then((ideSettings) => {
                // Index on initialization
                void this.ide.getWorkspaceDirs().then(async (dirs) => {
                    // Respect pauseCodebaseIndexOnStart user settings
                    if (ideSettings.pauseCodebaseIndexOnStart) {
                        this.codeBaseIndexer.paused = true;
                        void this.messenger.request("indexProgress", {
                            progress: 0,
                            desc: "Initial Indexing Skipped",
                            status: "paused",
                        });
                        return;
                    }
                    // Check for disableIndexing to prevent race condition
                    const { config } = await this.configHandler.loadConfig();
                    if (!config || config.disableIndexing) {
                        void this.messenger.request("indexProgress", {
                            progress: 0,
                            desc: "Indexing is disabled",
                            status: "disabled",
                        });
                        return;
                    }
                    void this.codeBaseIndexer.refreshCodebaseIndex(dirs);
                });
            });
            const getLlm = async () => {
                const { config } = await this.configHandler.loadConfig();
                if (!config) {
                    return undefined;
                }
                return config.selectedModelByRole.autocomplete ?? undefined;
            };
            this.completionProvider = new CompletionProvider_1.CompletionProvider(this.configHandler, ide, getLlm, (e) => { }, (..._) => Promise.resolve([]));
            const codebaseRulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
            void codebaseRulesCache
                .refresh(ide)
                .catch((e) => Logger_js_1.Logger.error("Failed to initialize colocated rules cache"))
                .then(() => {
                void this.configHandler.reloadConfig("Initial codebase rules post-walkdir/load reload");
            });
            this.nextEditProvider = NextEditProvider_1.NextEditProvider.initialize(this.configHandler, ide, getLlm, (e) => { }, (..._) => Promise.resolve([]), "fineTuned");
            this.registerMessageHandlers(ideSettingsPromise);
        }
        catch (error) {
            Logger_js_1.Logger.error(error);
            throw error; // Re-throw to prevent partially initialized core
        }
    }
    /* eslint-disable max-lines-per-function */
    registerMessageHandlers(ideSettingsPromise) {
        const on = this.messenger.on.bind(this.messenger);
        // Note, VsCode's in-process messenger doesn't do anything with this
        // It will only show for jetbrains
        this.messenger.onError((message, err) => {
            void posthog_1.Telemetry.capture("core_messenger_error", {
                message: err.message,
                stack: err.stack,
            });
            // just to prevent duplicate error messages in jetbrains (same logic in webview protocol)
            if (["llm/streamChat", "chatDescriber/describe"].includes(message.messageType)) {
                return;
            }
            else {
                void this.ide.showToast("error", err.message);
            }
        });
        on("abort", (msg) => {
            this.abortById(msg.data ?? msg.messageId);
        });
        on("ping", (msg) => {
            if (msg.data !== "ping") {
                throw new Error("ping message incorrect");
            }
            return "pong";
        });
        // History
        on("history/list", async (msg) => {
            const localSessions = history_1.default.list(msg.data);
            // Check if remote sessions should be enabled based on feature flags
            const shouldFetchRemote = await this.configHandler.controlPlaneClient.shouldEnableRemoteSessions();
            // Get remote sessions from control plane if feature is enabled
            const remoteSessions = shouldFetchRemote
                ? await this.configHandler.controlPlaneClient.listRemoteSessions()
                : [];
            // Combine and sort by date (most recent first)
            const allSessions = [...localSessions, ...remoteSessions].sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
            // Apply limit if specified
            const limit = msg.data?.limit ?? 100;
            return allSessions.slice(0, limit);
        });
        on("history/delete", (msg) => {
            history_1.default.delete(msg.data.id);
        });
        on("history/load", (msg) => {
            return history_1.default.load(msg.data.id);
        });
        on("history/loadRemote", async (msg) => {
            return this.configHandler.controlPlaneClient.loadRemoteSession(msg.data.remoteId);
        });
        on("history/save", (msg) => {
            history_1.default.save(msg.data);
        });
        on("history/share", async (msg) => {
            const session = history_1.default.load(msg.data.id);
            const outputDir = msg.data.outputDir;
            const history = session.history.map((msg) => msg.message);
            await (0, historyUtils_1.shareSession)(this.ide, history, outputDir);
        });
        on("history/clear", (msg) => {
            history_1.default.clearAll();
        });
        on("devdata/log", async (msg) => {
            void log_1.DataLogger.getInstance().logDevData(msg.data);
        });
        on("config/addModel", (msg) => {
            const model = msg.data.model;
            (0, util_1.addModel)(model, msg.data.role);
            void this.configHandler.reloadConfig("Model added (config/addModel message)");
        });
        on("config/deleteModel", (msg) => {
            (0, util_1.deleteModel)(msg.data.title);
            void this.configHandler.reloadConfig("Model removed (config/deleteModel message)");
        });
        on("config/newPromptFile", async (msg) => {
            const { config } = await this.configHandler.loadConfig();
            await (0, createNewPromptFile_1.createNewPromptFileV2)(this.ide, config?.experimental?.promptPath);
            await this.configHandler.reloadConfig("Prompt file created (config/newPromptFile message)");
        });
        on("config/newAssistantFile", async (msg) => {
            await (0, createNewAssistantFile_1.createNewAssistantFile)(this.ide, undefined);
            await this.configHandler.reloadConfig("Assistant file created (config/newAssistantFile message)");
        });
        on("config/addLocalWorkspaceBlock", async (msg) => {
            await (0, workspaceBlocks_1.createNewWorkspaceBlockFile)(this.ide, msg.data.blockType, msg.data.baseFilename);
            await this.configHandler.reloadConfig("Local block created (config/addLocalWorkspaceBlock message)");
        });
        on("config/addGlobalRule", async (msg) => {
            try {
                await (0, workspaceBlocks_1.createNewGlobalRuleFile)(this.ide, msg.data?.baseFilename);
                await this.configHandler.reloadConfig("Global rule created (config/addGlobalRule message)");
            }
            catch (error) {
                throw error;
            }
        });
        on("config/openProfile", async (msg) => {
            await this.configHandler.openConfigProfile(msg.data.profileId);
        });
        on("config/ideSettingsUpdate", async (msg) => {
            await this.configHandler.updateIdeSettings(msg.data);
        });
        on("config/refreshProfiles", async (msg) => {
            // User force reloading will retrigger colocated rules
            const codebaseRulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
            await codebaseRulesCache.refresh(this.ide);
            const { selectOrgId, selectProfileId, reason } = msg.data ?? {};
            await this.configHandler.refreshAll(reason);
            if (selectOrgId) {
                await this.configHandler.setSelectedOrgId(selectOrgId, selectProfileId);
            }
            else if (selectProfileId) {
                await this.configHandler.setSelectedProfileId(selectProfileId);
            }
        });
        on("config/updateSharedConfig", async (msg) => {
            const newSharedConfig = this.globalContext.updateSharedConfig(msg.data);
            await this.configHandler.reloadConfig("Shared config update (config/updateSharedConfig message)");
            return newSharedConfig;
        });
        on("config/updateSelectedModel", async (msg) => {
            const newSelectedModels = this.globalContext.updateSelectedModel(msg.data.profileId, msg.data.role, msg.data.title);
            await this.configHandler.reloadConfig("Selected model update (config/updateSelectedModel message)");
            return newSelectedModels;
        });
        on("controlPlane/openUrl", async (msg) => {
            const env = await (0, env_1.getControlPlaneEnv)(this.ide.getIdeSettings());
            const urlPath = msg.data.path.startsWith("/")
                ? msg.data.path.slice(1)
                : msg.data.path;
            let url;
            if (msg.data.orgSlug) {
                url = `${env.APP_URL}organizations/${msg.data.orgSlug}/${urlPath}`;
            }
            else {
                url = `${env.APP_URL}${urlPath}`;
            }
            await this.messenger.request("openUrl", url);
        });
        on("controlPlane/getEnvironment", async (msg) => {
            return await (0, env_1.getControlPlaneEnv)(this.ide.getIdeSettings());
        });
        on("controlPlane/getCreditStatus", async (msg) => {
            return this.configHandler.controlPlaneClient.getCreditStatus();
        });
        on("mcp/reloadServer", async (msg) => {
            await MCPManagerSingleton_1.MCPManagerSingleton.getInstance().refreshConnection(msg.data.id);
        });
        on("mcp/setServerEnabled", async (msg) => {
            const { id, enabled } = msg.data;
            await MCPManagerSingleton_1.MCPManagerSingleton.getInstance().setEnabled(id, enabled);
        });
        on("mcp/getPrompt", async (msg) => {
            const { serverName, promptName, args } = msg.data;
            const prompt = await MCPManagerSingleton_1.MCPManagerSingleton.getInstance().getPrompt(serverName, promptName, args);
            const stringifiedPrompt = (0, mcpSlashCommand_1.stringifyMcpPrompt)(prompt);
            return {
                prompt: stringifiedPrompt,
                description: prompt.description,
            };
        });
        on("mcp/startAuthentication", async (msg) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            MCPManagerSingleton_1.MCPManagerSingleton.getInstance().setStatus(msg.data.serverId, "authenticating");
            const status = await (0, MCPOauth_1.performAuth)(msg.data.serverId, msg.data.serverUrl, this.ide);
            if (status === "AUTHORIZED") {
                await MCPManagerSingleton_1.MCPManagerSingleton.getInstance().refreshConnection(msg.data.serverId);
            }
        });
        on("mcp/removeAuthentication", async (msg) => {
            (0, MCPOauth_1.removeMCPAuth)(msg.data.serverUrl, this.ide);
            await MCPManagerSingleton_1.MCPManagerSingleton.getInstance().refreshConnection(msg.data.serverId);
        });
        // Context providers
        on("context/addDocs", async (msg) => {
            void this.docsService.indexAndAdd(msg.data);
        });
        on("context/removeDocs", async (msg) => {
            await this.docsService.delete(msg.data.startUrl);
        });
        on("context/indexDocs", async (msg) => {
            await this.docsService.syncDocsWithPrompt(msg.data.reIndex);
        });
        on("context/loadSubmenuItems", async (msg) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config) {
                return [];
            }
            try {
                const items = await config.contextProviders
                    ?.find((provider) => provider.description.title === msg.data.title)
                    ?.loadSubmenuItems({
                    config,
                    ide: this.ide,
                    fetch: (url, init) => (0, fetch_1.fetchwithRequestOptions)(url, init, config.requestOptions),
                });
                return items || [];
            }
            catch (e) {
                Logger_js_1.Logger.error(e);
                return [];
            }
        });
        on("context/getContextItems", this.getContextItems.bind(this));
        on("context/getSymbolsForFiles", async (msg) => {
            const { uris } = msg.data;
            return await (0, treeSitter_1.getSymbolsForManyFiles)(uris, this.ide);
        });
        on("config/getSerializedProfileInfo", async (msg) => {
            return {
                result: await this.configHandler.getSerializedConfig(),
                profileId: this.configHandler.currentProfile?.profileDescription.id ?? null,
                organizations: this.configHandler.getSerializedOrgs(),
                selectedOrgId: this.configHandler.currentOrg?.id ?? null,
            };
        });
        on("llm/streamChat", (msg) => {
            const abortController = this.addMessageAbortController(msg.messageId);
            return (0, streamChat_1.llmStreamChat)(this.configHandler, abortController, msg, this.ide, this.messenger);
        });
        on("llm/complete", async (msg) => {
            const { config } = await this.configHandler.loadConfig();
            const model = config?.selectedModelByRole.chat;
            if (!model) {
                throw new Error("No chat model selected");
            }
            const abortController = this.addMessageAbortController(msg.messageId);
            const completion = await model.complete(msg.data.prompt, abortController.signal, msg.data.completionOptions);
            return completion;
        });
        on("llm/listModels", this.handleListModels.bind(this));
        on("llm/compileChat", async (msg) => {
            const { messages, options } = msg.data;
            const model = (await this.configHandler.loadConfig()).config
                ?.selectedModelByRole.chat;
            if (!model) {
                throw new Error("No chat model selected");
            }
            return model.compileChatMessages(messages, options);
        });
        // Provide messenger to utils so they can interact with GUI + state
        tts_1.TTS.messenger = this.messenger;
        chatDescriber_1.ChatDescriber.messenger = this.messenger;
        on("tts/kill", async () => {
            void tts_1.TTS.kill();
        });
        on("chatDescriber/describe", async (msg) => {
            const currentModel = (await this.configHandler.loadConfig()).config
                ?.selectedModelByRole.chat;
            if (!currentModel) {
                throw new Error("No chat model selected");
            }
            return await chatDescriber_1.ChatDescriber.describe(currentModel, {}, msg.data.text);
        });
        on("conversation/compact", async (msg) => {
            const currentModel = (await this.configHandler.loadConfig()).config
                ?.selectedModelByRole.chat;
            if (!currentModel) {
                throw new Error("No chat model selected");
            }
            try {
                await (0, conversationCompaction_1.compactConversation)({
                    sessionId: msg.data.sessionId,
                    index: msg.data.index,
                    historyManager: history_1.default,
                    currentModel,
                });
                return undefined;
            }
            catch (error) {
                Logger_js_1.Logger.error(`Error compacting conversation: ${error}`);
                return undefined;
            }
        });
        // Autocomplete
        on("autocomplete/complete", async (msg) => {
            const outcome = await this.completionProvider.provideInlineCompletionItems(msg.data, undefined);
            return outcome ? [outcome.completion] : [];
        });
        on("autocomplete/accept", async (msg) => {
            this.completionProvider.accept(msg.data.completionId);
        });
        on("autocomplete/cancel", async (msg) => {
            this.completionProvider.cancel();
        });
        // Next Edit
        on("nextEdit/predict", async (msg) => {
            const outcome = await this.nextEditProvider.provideInlineCompletionItems(msg.data.input, undefined, {
                withChain: msg.data.options?.withChain ?? false,
                usingFullFileDiff: msg.data.options?.usingFullFileDiff ?? true,
            });
            return outcome;
            // ? [outcome.completion, outcome.originalEditableRange]
        });
        on("nextEdit/accept", async (msg) => {
            console.log("nextEdit/accept");
            this.nextEditProvider.accept(msg.data.completionId);
        });
        on("nextEdit/reject", async (msg) => {
            console.log("nextEdit/reject");
            this.nextEditProvider.reject(msg.data.completionId);
        });
        on("nextEdit/startChain", async (msg) => {
            console.log("nextEdit/startChain");
            NextEditProvider_1.NextEditProvider.getInstance().startChain();
            return;
        });
        on("nextEdit/deleteChain", async (msg) => {
            console.log("nextEdit/deleteChain");
            await NextEditProvider_1.NextEditProvider.getInstance().deleteChain();
            return;
        });
        on("nextEdit/isChainAlive", async (msg) => {
            console.log("nextEdit/isChainAlive");
            return NextEditProvider_1.NextEditProvider.getInstance().chainExists();
        });
        on("nextEdit/queue/getProcessedCount", async (msg) => {
            console.log("nextEdit/queue/getProcessedCount");
            const queue = NextEditPrefetchQueue_1.PrefetchQueue.getInstance();
            console.log(queue.processedCount);
            return queue.processedCount;
        });
        on("nextEdit/queue/dequeueProcessed", async (msg) => {
            console.log("nextEdit/queue/dequeueProcessed");
            const queue = NextEditPrefetchQueue_1.PrefetchQueue.getInstance();
            return queue.dequeueProcessed() || null;
        });
        // NOTE: This is not used unless prefetch is used.
        // At this point this is not used because I opted to rely on the model to return multiple diffs than to use prefetching.
        on("nextEdit/queue/processOne", async (msg) => {
            console.log("nextEdit/queue/processOne");
            const { ctx, recentlyVisitedRanges, recentlyEditedRanges } = msg.data;
            const queue = NextEditPrefetchQueue_1.PrefetchQueue.getInstance();
            await queue.process({
                ...ctx,
                recentlyVisitedRanges,
                recentlyEditedRanges,
            });
            return;
        });
        on("nextEdit/queue/clear", async (msg) => {
            console.log("nextEdit/queue/clear");
            const queue = NextEditPrefetchQueue_1.PrefetchQueue.getInstance();
            queue.clear();
            return;
        });
        on("nextEdit/queue/abort", async (msg) => {
            console.log("nextEdit/queue/abort");
            const queue = NextEditPrefetchQueue_1.PrefetchQueue.getInstance();
            queue.abort();
            return;
        });
        on("streamDiffLines", async (msg) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config) {
                throw new Error("Failed to load config");
            }
            const { data } = msg;
            // Title can be an edit, chat, or apply model
            // Fall back to chat
            const llm = config.modelsByRole.edit.find((m) => m.title === data.modelTitle) ??
                config.modelsByRole.apply.find((m) => m.title === data.modelTitle) ??
                config.modelsByRole.chat.find((m) => m.title === data.modelTitle) ??
                config.selectedModelByRole.chat;
            if (!llm) {
                throw new Error("No model selected");
            }
            const abortManager = applyAbortManager_1.ApplyAbortManager.getInstance();
            const abortController = abortManager.get(data.fileUri ?? "current-file-stream"); // not super important since currently cancelling apply will cancel all streams it's one file at a time
            return (0, streamDiffLines_1.streamDiffLines)(data, llm, abortController, undefined, data.includeRulesInSystemMessage ? config.rules : undefined);
        });
        on("getDiffLines", (msg) => {
            return (0, myers_1.myersDiff)(msg.data.oldContent, msg.data.newContent);
        });
        on("cancelApply", async (msg) => {
            const abortManager = applyAbortManager_1.ApplyAbortManager.getInstance();
            abortManager.clear(); // for now abort all streams
        });
        on("onboarding/complete", this.handleCompleteOnboarding.bind(this));
        on("addAutocompleteModel", this.handleAddAutocompleteModel.bind(this));
        on("stats/getTokensPerDay", async (msg) => {
            const rows = await devdataSqlite_1.DevDataSqliteDb.getTokensPerDay();
            return rows;
        });
        on("stats/getTokensPerModel", async (msg) => {
            const rows = await devdataSqlite_1.DevDataSqliteDb.getTokensPerModel();
            return rows;
        });
        on("index/forceReIndex", async ({ data }) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config || config.disableIndexing) {
                return; // TODO silent in case of commands?
            }
            walkDir_1.walkDirCache.invalidate();
            if (data?.shouldClearIndexes) {
                await this.codeBaseIndexer.clearIndexes();
            }
            const dirs = data?.dirs ?? (await this.ide.getWorkspaceDirs());
            await this.codeBaseIndexer.refreshCodebaseIndex(dirs);
        });
        on("index/setPaused", (msg) => {
            this.globalContext.update("indexingPaused", msg.data);
            // Update using the new setter instead of token
            this.codeBaseIndexer.paused = msg.data;
        });
        on("index/indexingProgressBarInitialized", async (msg) => {
            // Triggered when progress bar is initialized.
            // If a non-default state has been stored, update the indexing display to that state
            const currentState = this.codeBaseIndexer.currentIndexingState;
            if (currentState.status !== "loading") {
                void this.messenger.request("indexProgress", currentState);
            }
        });
        // File changes - TODO - remove remaining logic for these from IDEs where possible
        on("files/changed", this.handleFilesChanged.bind(this));
        const refreshIfNotIgnored = async (uris) => {
            const toRefresh = [];
            for (const uri of uris) {
                const ignore = await (0, shouldIgnore_1.shouldIgnore)(uri, this.ide);
                if (!ignore) {
                    toRefresh.push(uri);
                }
            }
            if (toRefresh.length > 0) {
                this.messenger.send("refreshSubmenuItems", {
                    providers: ["file"],
                });
                const { config } = await this.configHandler.loadConfig();
                if (config && !config.disableIndexing) {
                    await this.codeBaseIndexer.refreshCodebaseIndexFiles(toRefresh);
                }
            }
        };
        on("files/created", async ({ data }) => {
            if (!data?.uris?.length) {
                return;
            }
            walkDir_1.walkDirCache.invalidate();
            void refreshIfNotIgnored(data.uris);
            const colocatedRulesUris = data.uris.filter(loadLocalAssistants_1.isColocatedRulesFile);
            const nonColocatedRuleUris = data.uris.filter((uri) => !(0, loadLocalAssistants_1.isColocatedRulesFile)(uri));
            if (colocatedRulesUris) {
                const rulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
                void Promise.all(colocatedRulesUris.map((uri) => rulesCache.update(this.ide, uri))).then(() => {
                    void this.configHandler.reloadConfig("Codebase rule file created");
                });
            }
            // If it's a local config being created, we want to reload all configs so it shows up in the list
            if (nonColocatedRuleUris.some(loadLocalAssistants_1.isContinueAgentConfigFile)) {
                await this.configHandler.refreshAll("Local config file created");
            }
            else if (nonColocatedRuleUris.some(loadLocalAssistants_1.isContinueConfigRelatedUri)) {
                await this.configHandler.reloadConfig(".continue config-related file created");
            }
        });
        on("files/deleted", async ({ data }) => {
            if (!data?.uris?.length) {
                return;
            }
            walkDir_1.walkDirCache.invalidate();
            void refreshIfNotIgnored(data.uris);
            const colocatedRulesUris = data.uris.filter(loadLocalAssistants_1.isColocatedRulesFile);
            const nonColocatedRuleUris = data.uris.filter((uri) => !(0, loadLocalAssistants_1.isColocatedRulesFile)(uri));
            if (colocatedRulesUris) {
                const rulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
                void Promise.all(colocatedRulesUris.map((uri) => rulesCache.remove(uri))).then(() => {
                    void this.configHandler.reloadConfig("Codebase rule file deleted");
                });
            }
            // If it's a local config being deleted, we want to reload all configs so it disappears from the list
            if (nonColocatedRuleUris.some(loadLocalAssistants_1.isContinueAgentConfigFile)) {
                await this.configHandler.refreshAll("Local config file deleted");
            }
            else if (nonColocatedRuleUris.some(loadLocalAssistants_1.isContinueConfigRelatedUri)) {
                await this.configHandler.reloadConfig(".continue config-related file deleted");
            }
        });
        on("files/closed", async ({ data }) => {
            console.debug("deleteChain called from files/closed");
            await NextEditProvider_1.NextEditProvider.getInstance().deleteChain();
            try {
                const fileUris = await this.ide.getOpenFiles();
                if (fileUris) {
                    const filepaths = fileUris.map((uri) => uri.toString());
                    if (!openedFilesLruCache_1.prevFilepaths.filepaths.length) {
                        openedFilesLruCache_1.prevFilepaths.filepaths = filepaths;
                    }
                    // If there is a removal, including if the number of tabs is the same (which can happen with temp tabs)
                    if (filepaths.length <= openedFilesLruCache_1.prevFilepaths.filepaths.length) {
                        // Remove files from cache that are no longer open (i.e. in the cache but not in the list of opened tabs)
                        for (const [key, _] of openedFilesLruCache_1.openedFilesLruCache.entriesDescending()) {
                            if (!filepaths.includes(key)) {
                                openedFilesLruCache_1.openedFilesLruCache.delete(key);
                            }
                        }
                    }
                    openedFilesLruCache_1.prevFilepaths.filepaths = filepaths;
                }
            }
            catch (e) {
                Logger_js_1.Logger.error(`didChangeVisibleTextEditors: failed to update openedFilesLruCache`);
            }
            if (data.uris) {
                this.messenger.send("didCloseFiles", {
                    uris: data.uris,
                });
            }
        });
        on("files/opened", async ({ data: { uris } }) => {
            if (uris) {
                for (const filepath of uris) {
                    try {
                        const ignore = await (0, shouldIgnore_1.shouldIgnore)(filepath, this.ide);
                        if (!ignore) {
                            // Set the active file as most recently used (need to force recency update by deleting and re-adding)
                            if (openedFilesLruCache_1.openedFilesLruCache.has(filepath)) {
                                openedFilesLruCache_1.openedFilesLruCache.delete(filepath);
                            }
                            openedFilesLruCache_1.openedFilesLruCache.set(filepath, filepath);
                        }
                    }
                    catch (e) {
                        Logger_js_1.Logger.error(`files/opened: failed to update openedFiles cache for ${filepath}`);
                    }
                }
            }
        });
        on("files/smallEdit", async ({ data }) => {
            const EDIT_AGGREGATION_OPTIONS = {
                deltaT: 1.0,
                deltaL: 5,
                maxEdits: 500,
                maxDuration: 120.0,
                contextSize: 5,
            };
            aggregateEdits_1.EditAggregator.getInstance(EDIT_AGGREGATION_OPTIONS, (beforeAfterdiff, cursorPosBeforeEdit, cursorPosAfterPrevEdit) => {
                void (0, processSmallEdit_1.processSmallEdit)(beforeAfterdiff, cursorPosBeforeEdit, cursorPosAfterPrevEdit, data.configHandler, data.getDefsFromLspFunction, this.ide);
            });
            const workspaceDir = data.actions.length > 0 ? data.actions[0].workspaceDir : undefined;
            // Store the latest context data
            const instance = aggregateEdits_1.EditAggregator.getInstance();
            instance.latestContextData = {
                configHandler: data.configHandler,
                getDefsFromLspFunction: data.getDefsFromLspFunction,
                recentlyEditedRanges: data.recentlyEditedRanges,
                recentlyVisitedRanges: data.recentlyVisitedRanges,
                workspaceDir: workspaceDir,
            };
            // queueMicrotask prevents blocking the UI thread during typing
            queueMicrotask(() => {
                void aggregateEdits_1.EditAggregator.getInstance().processEdits(data.actions);
            });
        });
        // Docs, etc. indexing
        on("indexing/reindex", async (msg) => {
            if (msg.data.type === "docs") {
                void this.docsService.reindexDoc(msg.data.id);
            }
        });
        on("indexing/abort", async (msg) => {
            if (msg.data.type === "docs") {
                this.docsService.abort(msg.data.id);
            }
        });
        on("indexing/setPaused", async (msg) => {
            if (msg.data.type === "docs") {
            }
        });
        on("docs/initStatuses", async (msg) => {
            void this.docsService.initStatuses();
        });
        on("docs/getDetails", async (msg) => {
            return await this.docsService.getDetails(msg.data.startUrl);
        });
        on("docs/getIndexedPages", async (msg) => {
            const pages = await this.docsService.getIndexedPages(msg.data.startUrl);
            return Array.from(pages);
        });
        on("didChangeSelectedProfile", async (msg) => {
            if (msg.data.id) {
                await this.configHandler.setSelectedProfileId(msg.data.id);
            }
        });
        on("didChangeSelectedOrg", async (msg) => {
            if (msg.data.id) {
                await this.configHandler.setSelectedOrgId(msg.data.id, msg.data.profileId || undefined);
            }
        });
        on("didChangeControlPlaneSessionInfo", async (msg) => {
            this.messenger.send("sessionUpdate", {
                sessionInfo: msg.data.sessionInfo,
            });
            await this.configHandler.updateControlPlaneSessionInfo(msg.data.sessionInfo);
        });
        on("auth/getAuthUrl", async (msg) => {
            const url = await (0, index_1.getAuthUrlForTokenPage)(ideSettingsPromise, msg.data.useOnboarding);
            return { url };
        });
        on("tools/call", async ({ data: { toolCall } }) => this.handleToolCall(toolCall));
        on("tools/evaluatePolicy", async ({ data: { toolName, basePolicy, parsedArgs, processedArgs } }) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config) {
                throw new Error("Config not loaded");
            }
            const tool = config.tools.find((t) => t.function.name === toolName);
            if (!tool) {
                return { policy: basePolicy };
            }
            // Extract display value for specific tools
            let displayValue;
            if (toolName === "runTerminalCommand" && parsedArgs.command) {
                displayValue = parsedArgs.command;
            }
            if (tool.evaluateToolCallPolicy) {
                const evaluatedPolicy = tool.evaluateToolCallPolicy(basePolicy, parsedArgs, processedArgs);
                return { policy: evaluatedPolicy, displayValue };
            }
            return { policy: basePolicy, displayValue };
        });
        on("tools/preprocessArgs", async ({ data: { toolName, args } }) => {
            const { config } = await this.configHandler.loadConfig();
            if (!config) {
                throw new Error("Config not loaded");
            }
            const tool = config?.tools.find((t) => t.function.name === toolName);
            if (!tool) {
                throw new Error(`Tool ${toolName} not found`);
            }
            try {
                const preprocessedArgs = await tool.preprocessArgs?.(args, {
                    ide: this.ide,
                });
                return {
                    preprocessedArgs,
                };
            }
            catch (e) {
                let errorReason = e instanceof errors_1.ContinueError ? e.reason : errors_1.ContinueErrorReason.Unknown;
                let errorMessage = e instanceof Error
                    ? e.message
                    : `Error preprocessing tool call args for ${toolName}\n${JSON.stringify(args)}`;
                return {
                    preprocessedArgs: undefined,
                    errorReason,
                    errorMessage,
                };
            }
        });
        on("isItemTooBig", async ({ data: { item } }) => {
            return this.isItemTooBig(item);
        });
        // Process state handlers
        on("process/markAsBackgrounded", async ({ data: { toolCallId } }) => {
            (0, processTerminalStates_1.markProcessAsBackgrounded)(toolCallId);
        });
        on("process/isBackgrounded", async ({ data: { toolCallId }, messageId }) => {
            const isBackgrounded = (0, processTerminalStates_1.isProcessBackgrounded)(toolCallId);
            return isBackgrounded; // Return true to indicate the message was handled successfully
        });
        on("process/killTerminalProcess", async ({ data: { toolCallId } }) => {
            await (0, processTerminalStates_1.killTerminalProcess)(toolCallId);
        });
        on("mdm/setLicenseKey", ({ data: { licenseKey } }) => {
            const isValid = (0, mdm_1.setMdmLicenseKey)(licenseKey);
            return isValid;
        });
    }
    async handleToolCall(toolCall) {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
            throw new Error("Config not loaded");
        }
        const tool = config.tools.find((t) => t.function.name === toolCall.function.name);
        if (!tool) {
            throw new Error(`Tool ${toolCall.function.name} not found`);
        }
        if (!config.selectedModelByRole.chat) {
            throw new Error("No chat model selected");
        }
        // Define a callback for streaming output updates
        const onPartialOutput = (params) => {
            this.messenger.send("toolCallPartialOutput", params);
        };
        const result = await (0, callTool_1.callTool)(tool, toolCall, {
            config,
            ide: this.ide,
            llm: config.selectedModelByRole.chat,
            fetch: (url, init) => (0, fetch_1.fetchwithRequestOptions)(url, init, config.requestOptions),
            tool,
            toolCallId: toolCall.id,
            onPartialOutput,
            codeBaseIndexer: this.codeBaseIndexer,
        });
        return result;
    }
    async isItemTooBig(item) {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
            return false;
        }
        const llm = config?.selectedModelByRole.chat;
        if (!llm) {
            throw new Error("No chat model selected");
        }
        const tokens = (0, countTokens_1.countTokens)(item.content, llm.model);
        if (tokens > llm.contextLength - llm.completionOptions.maxTokens) {
            return true;
        }
        return false;
    }
    handleAddAutocompleteModel(msg) {
        const model = msg.data.model;
        (0, paths_1.editConfigFile)((config) => {
            return {
                ...config,
                tabAutocompleteModel: model,
            };
        }, (config) => ({
            ...config,
            models: [
                ...(config.models ?? []),
                {
                    name: model.title,
                    provider: model.provider,
                    model: model.model,
                    apiKey: model.apiKey,
                    roles: ["autocomplete"],
                    apiBase: model.apiBase,
                },
            ],
        }));
        void this.configHandler.reloadConfig("Autocomplete model added");
    }
    async handleFilesChanged({ data, }) {
        if (data?.uris?.length) {
            const diffCache = gitDiffCache_1.GitDiffCache.getInstance((0, gitDiffCache_1.getDiffFn)(this.ide));
            diffCache.invalidate();
            walkDir_1.walkDirCache.invalidate(); // safe approach for now - TODO - only invalidate on relevant changes
            const currentProfileUri = this.configHandler.currentProfile?.profileDescription.uri ?? "";
            for (const uri of data.uris) {
                if (URI.equal(uri, currentProfileUri)) {
                    // Trigger a toast notification to provide UI feedback that config has been updated
                    const showToast = this.globalContext.get("showConfigUpdateToast") ?? true;
                    if (showToast) {
                        const selection = await this.ide.showToast("info", "Config updated", "Don't show again");
                        if (selection === "Don't show again") {
                            this.globalContext.update("showConfigUpdateToast", false);
                        }
                    }
                    await this.configHandler.reloadConfig("Current profile config file updated");
                    continue;
                }
                if ((0, loadLocalAssistants_1.isColocatedRulesFile)(uri)) {
                    try {
                        const codebaseRulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
                        void codebaseRulesCache.update(this.ide, uri).then(() => {
                            void this.configHandler.reloadConfig("Codebase rule update");
                        });
                    }
                    catch (e) {
                        Logger_js_1.Logger.error(`Failed to update codebase rule: ${e}`);
                    }
                }
                else if ((0, loadLocalAssistants_1.isContinueConfigRelatedUri)(uri)) {
                    await this.configHandler.reloadConfig("Local config-related file updated");
                }
                else if (uri.endsWith(".continueignore") ||
                    uri.endsWith(".gitignore")) {
                    // Reindex the workspaces
                    this.invoke("index/forceReIndex", {
                        shouldClearIndexes: true,
                    });
                }
                else {
                    const { config } = await this.configHandler.loadConfig();
                    if (config && !config.disableIndexing) {
                        // Reindex the file
                        const ignore = await (0, shouldIgnore_1.shouldIgnore)(uri, this.ide);
                        if (!ignore) {
                            await this.codeBaseIndexer.refreshCodebaseIndexFiles([uri]);
                        }
                    }
                }
            }
        }
    }
    async handleListModels(msg) {
        const { config } = await this.configHandler.loadConfig();
        if (!config) {
            return [];
        }
        const model = config.modelsByRole.chat.find((model) => model.title === msg.data.title) ??
            config.modelsByRole.chat.find((model) => model.title?.startsWith(msg.data.title));
        try {
            if (model) {
                return await model.listModels();
            }
            else {
                if (msg.data.title === "Ollama") {
                    const models = await new Ollama_1.default({ model: "" }).listModels();
                    return models;
                }
                else if (msg.data.title === "Lemonade") {
                    const models = await new Lemonade_1.default({ model: "" }).listModels();
                    return models;
                }
                else {
                    return undefined;
                }
            }
        }
        catch (e) {
            console.debug(`Error listing Ollama models: ${e}`);
            return undefined;
        }
    }
    async handleCompleteOnboarding(msg) {
        const { mode, provider, apiKey } = msg.data;
        let editConfigYamlCallback;
        switch (mode) {
            case core_1.OnboardingModes.LOCAL:
                editConfigYamlCallback = onboarding_1.setupLocalConfig;
                break;
            case core_1.OnboardingModes.API_KEY:
                if (provider && apiKey) {
                    editConfigYamlCallback = (config) => (0, onboarding_1.setupProviderConfig)(config, provider, apiKey);
                }
                else {
                    editConfigYamlCallback = onboarding_1.setupQuickstartConfig;
                }
                break;
            default:
                Logger_js_1.Logger.error(`Invalid mode: ${mode}`);
                editConfigYamlCallback = (config) => config;
        }
        (0, paths_1.editConfigFile)((c) => c, editConfigYamlCallback);
        void this.configHandler.reloadConfig("Onboarding completed");
    }
}
exports.Core = Core;
//# sourceMappingURL=core.js.map