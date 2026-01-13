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
exports.resolveSerializedConfig = resolveSerializedConfig;
exports.isContextProviderWithParams = isContextProviderWithParams;
exports.finalToBrowserConfig = finalToBrowserConfig;
exports.loadContinueConfigFromJson = loadContinueConfigFromJson;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const config_yaml_1 = require("@continuedev/config-yaml");
const JSONC = __importStar(require("comment-json"));
const built_in_legacy_1 = require("../commands/slash/built-in-legacy");
const customSlashCommand_1 = require("../commands/slash/customSlashCommand");
const promptFileSlashCommand_1 = require("../commands/slash/promptFileSlashCommand");
const MCPManagerSingleton_1 = require("../context/mcp/MCPManagerSingleton");
const env_1 = require("../control-plane/env");
const llms_1 = require("../llm/llms");
const CustomLLM_1 = __importDefault(require("../llm/llms/CustomLLM"));
const llm_1 = require("../llm/llms/llm");
const TransformersJsEmbeddingsProvider_1 = __importDefault(require("../llm/llms/TransformersJsEmbeddingsProvider"));
const getPromptFiles_1 = require("../promptFiles/getPromptFiles");
const util_1 = require("../util");
const GlobalContext_1 = require("../util/GlobalContext");
const merge_1 = __importDefault(require("../util/merge"));
const paths_1 = require("../util/paths");
const pathToUri_1 = require("../util/pathToUri");
const loadJsonMcpConfigs_1 = require("../context/mcp/json/loadJsonMcpConfigs");
const CustomContextProvider_1 = __importDefault(require("../context/providers/CustomContextProvider"));
const PolicySingleton_1 = require("../control-plane/PolicySingleton");
const tools_1 = require("../tools");
const ideUtils_1 = require("../util/ideUtils");
const loadRcConfigs_1 = require("./json/loadRcConfigs");
const loadContextProviders_1 = require("./loadContextProviders");
const sharedConfig_1 = require("./sharedConfig");
const util_2 = require("./util");
const validation_js_1 = require("./validation.js");
function resolveSerializedConfig(filepath) {
    let content = fs.readFileSync(filepath, "utf8");
    const config = JSONC.parse(content);
    if (config.env && Array.isArray(config.env)) {
        const env = {
            ...process.env,
            ...(0, paths_1.getContinueDotEnv)(),
        };
        config.env.forEach((envVar) => {
            if (envVar in env) {
                content = content.replaceAll(new RegExp(`"${envVar}"`, "g"), `"${env[envVar]}"`);
            }
        });
    }
    return JSONC.parse(content);
}
const configMergeKeys = {
    models: (a, b) => a.title === b.title,
    contextProviders: (a, b) => {
        // If not HTTP providers, use the name only
        if (a.name !== "http" || b.name !== "http") {
            return a.name === b.name;
        }
        // For HTTP providers, consider them different if they have different URLs
        return a.name === b.name && a.params?.url === b.params?.url;
    },
    slashCommands: (a, b) => a.name === b.name,
    customCommands: (a, b) => a.name === b.name,
};
function loadSerializedConfig(workspaceConfigs, ideSettings, ideType, overrideConfigJson, ide) {
    let config = overrideConfigJson;
    if (!config) {
        try {
            config = resolveSerializedConfig((0, paths_1.getConfigJsonPath)());
        }
        catch (e) {
            throw new Error(`Failed to parse config.json: ${e}`);
        }
    }
    const errors = (0, validation_js_1.validateConfig)(config);
    if (errors?.some((error) => error.fatal)) {
        return {
            errors,
            config: undefined,
            configLoadInterrupted: true,
        };
    }
    if (config.allowAnonymousTelemetry === undefined) {
        config.allowAnonymousTelemetry = true;
    }
    if (ideSettings.remoteConfigServerUrl) {
        try {
            const remoteConfigJson = resolveSerializedConfig((0, paths_1.getConfigJsonPathForRemote)(ideSettings.remoteConfigServerUrl));
            config = (0, merge_1.default)(config, remoteConfigJson, "merge", configMergeKeys);
        }
        catch (e) {
            console.warn("Error loading remote config: ", e);
        }
    }
    for (const workspaceConfig of workspaceConfigs) {
        config = (0, merge_1.default)(config, workspaceConfig, workspaceConfig.mergeBehavior, configMergeKeys);
    }
    if (os_1.default.platform() === "linux" && !(0, util_2.isSupportedLanceDbCpuTargetForLinux)(ide)) {
        config.disableIndexing = true;
    }
    return { config, errors, configLoadInterrupted: false };
}
async function serializedToIntermediateConfig(initial, ide) {
    // DEPRECATED - load custom slash commands
    const slashCommands = [];
    for (const command of initial.slashCommands || []) {
        const newCommand = (0, built_in_legacy_1.getLegacyBuiltInSlashCommandFromDescription)(command);
        if (newCommand) {
            slashCommands.push(newCommand);
        }
    }
    for (const command of initial.customCommands || []) {
        slashCommands.push((0, customSlashCommand_1.convertCustomCommandToSlashCommand)(command));
    }
    // DEPRECATED - load slash commands from v1 prompt files
    // NOTE: still checking the v1 default .prompts folder for slash commands
    const promptFiles = await (0, getPromptFiles_1.getAllPromptFiles)(ide, initial.experimental?.promptPath, true);
    for (const file of promptFiles) {
        const slashCommand = (0, promptFileSlashCommand_1.slashCommandFromPromptFile)(file.path, file.content);
        if (slashCommand) {
            slashCommands.push(slashCommand);
        }
    }
    const config = {
        ...initial,
        slashCommands,
        contextProviders: initial.contextProviders || [],
    };
    return config;
}
// Merge request options set for entire config with model specific options
function applyRequestOptionsToModels(models, config, roles = undefined) {
    // Prepare models
    for (const model of models) {
        model.requestOptions = {
            ...config.requestOptions,
            ...model.requestOptions,
        };
        if (roles !== undefined) {
            model.roles = model.roles ?? roles;
        }
    }
}
function isContextProviderWithParams(contextProvider) {
    return "name" in contextProvider && !!contextProvider.name;
}
/** Only difference between intermediate and final configs is the `models` array */
async function intermediateToFinalConfig({ config, ide, ideSettings, ideInfo, uniqueId, llmLogger, workOsAccessToken, loadPromptFiles = true, }) {
    const errors = [];
    const workspaceDirs = await ide.getWorkspaceDirs();
    const getUriFromPath = (path) => {
        return (0, ideUtils_1.resolveRelativePathInDir)(path, ide, workspaceDirs);
    };
    // Auto-detect models
    let models = [];
    await Promise.all(config.models.map(async (desc) => {
        if ("title" in desc) {
            const llm = await (0, llms_1.llmFromDescription)(desc, ide.readFile.bind(ide), getUriFromPath, uniqueId, ideSettings, llmLogger, config.completionOptions);
            if (!llm) {
                return;
            }
            if (llm.model === "AUTODETECT") {
                try {
                    const modelNames = await llm.listModels();
                    const detectedModels = await Promise.all(modelNames.map(async (modelName) => {
                        return await (0, llms_1.llmFromDescription)({
                            ...desc,
                            model: modelName,
                            title: modelName,
                            isFromAutoDetect: true,
                        }, ide.readFile.bind(ide), getUriFromPath, uniqueId, ideSettings, llmLogger, (0, util_1.copyOf)(config.completionOptions));
                    }));
                    models.push(...detectedModels.filter((x) => typeof x !== "undefined"));
                }
                catch (e) {
                    console.warn("Error listing models: ", e);
                }
            }
            else {
                models.push(llm);
            }
        }
        else {
            const llm = new CustomLLM_1.default({
                ...desc,
                options: { ...desc.options, logger: llmLogger },
            });
            if (llm.model === "AUTODETECT") {
                try {
                    const modelNames = await llm.listModels();
                    const models = modelNames.map((modelName) => new CustomLLM_1.default({
                        ...desc,
                        options: {
                            ...desc.options,
                            model: modelName,
                            logger: llmLogger,
                            isFromAutoDetect: true,
                        },
                    }));
                    models.push(...models);
                }
                catch (e) {
                    console.warn("Error listing models: ", e);
                }
            }
            else {
                models.push(llm);
            }
        }
    }));
    applyRequestOptionsToModels(models, config, [
        "chat",
        "apply",
        "edit",
        "summarize",
    ]); // Default to chat role if not specified
    // Free trial provider will be completely ignored
    let warnAboutFreeTrial = false;
    models = models.filter((model) => model.providerName !== "free-trial");
    if (models.filter((m) => m.providerName === "free-trial").length) {
        warnAboutFreeTrial = true;
    }
    // Tab autocomplete model
    const tabAutocompleteModels = [];
    if (config.tabAutocompleteModel) {
        const autocompleteConfigs = Array.isArray(config.tabAutocompleteModel)
            ? config.tabAutocompleteModel
            : [config.tabAutocompleteModel];
        await Promise.all(autocompleteConfigs.map(async (desc) => {
            if ("title" in desc) {
                const llm = await (0, llms_1.llmFromDescription)(desc, ide.readFile.bind(ide), getUriFromPath, uniqueId, ideSettings, llmLogger, config.completionOptions);
                if (llm) {
                    if (llm.providerName === "free-trial") {
                        warnAboutFreeTrial = true;
                    }
                    else {
                        tabAutocompleteModels.push(llm);
                    }
                }
            }
            else {
                tabAutocompleteModels.push(new CustomLLM_1.default(desc));
            }
        }));
    }
    applyRequestOptionsToModels(tabAutocompleteModels, config);
    // Load context providers
    const { providers: contextProviders, errors: contextErrors } = (0, loadContextProviders_1.loadConfigContextProviders)(config.contextProviders
        ?.filter((cp) => isContextProviderWithParams(cp))
        .map((cp) => ({
        provider: cp.name,
        params: cp.params,
    })), !!config.docs?.length, ideInfo.ideType);
    for (const cp of config.contextProviders ?? []) {
        if (!isContextProviderWithParams(cp)) {
            contextProviders.push(new CustomContextProvider_1.default(cp));
        }
    }
    errors.push(...contextErrors);
    // Embeddings Provider
    function getEmbeddingsILLM(embedConfig) {
        if (embedConfig) {
            // config.ts-injected ILLM
            if ("providerName" in embedConfig) {
                return embedConfig;
            }
            const { provider, ...options } = embedConfig;
            if (provider === "transformers.js" || provider === "free-trial") {
                if (provider === "free-trial") {
                    warnAboutFreeTrial = true;
                }
                return new TransformersJsEmbeddingsProvider_1.default();
            }
            else {
                const cls = llms_1.LLMClasses.find((c) => c.providerName === provider);
                if (cls) {
                    const llmOptions = {
                        model: options.model ?? "UNSPECIFIED",
                        ...options,
                    };
                    return new cls(llmOptions);
                }
                else {
                    errors.push({
                        fatal: false,
                        message: `Embeddings provider ${provider} not found`,
                    });
                }
            }
        }
        if (ideInfo.ideType === "vscode") {
            return new TransformersJsEmbeddingsProvider_1.default();
        }
        return null;
    }
    const newEmbedder = getEmbeddingsILLM(config.embeddingsProvider);
    // Reranker
    function getRerankingILLM(rerankingConfig) {
        if (!rerankingConfig) {
            return null;
        }
        // config.ts-injected ILLM
        if ("providerName" in rerankingConfig) {
            return rerankingConfig;
        }
        const { name, params } = config.reranker;
        if (name === "free-trial") {
            warnAboutFreeTrial = true;
            return null;
        }
        if (name === "llm") {
            const llm = models.find((model) => model.title === params?.modelTitle);
            if (!llm) {
                errors.push({
                    fatal: false,
                    message: `Unknown reranking model ${params?.modelTitle}`,
                });
                return null;
            }
            else {
                return new llm_1.LLMReranker(llm);
            }
        }
        else {
            const cls = llms_1.LLMClasses.find((c) => c.providerName === name);
            if (cls) {
                const llmOptions = {
                    model: params?.model ?? "UNSPECIFIED",
                    ...params,
                };
                return new cls(llmOptions);
            }
            else {
                errors.push({
                    fatal: false,
                    message: `Unknown reranking provider ${name}`,
                });
            }
        }
        return null;
    }
    const newReranker = getRerankingILLM(config.reranker);
    if (warnAboutFreeTrial) {
        errors.push({
            fatal: false,
            message: "Model provider 'free-trial' is no longer supported, will be ignored",
        });
    }
    const continueConfig = {
        ...config,
        contextProviders,
        tools: (0, tools_1.getBaseToolDefinitions)(),
        mcpServerStatuses: [],
        slashCommands: [],
        modelsByRole: {
            chat: models,
            edit: models,
            apply: models,
            summarize: models,
            autocomplete: [...tabAutocompleteModels],
            embed: newEmbedder ? [newEmbedder] : [],
            rerank: newReranker ? [newReranker] : [],
        },
        selectedModelByRole: {
            chat: null, // Not implemented (uses GUI defaultModel)
            edit: null,
            apply: null,
            embed: newEmbedder ?? null,
            autocomplete: null,
            rerank: newReranker ?? null,
            summarize: null, // Not implemented
        },
        rules: [],
    };
    for (const cmd of config.slashCommands ?? []) {
        if ("source" in cmd) {
            continueConfig.slashCommands.push(cmd);
        }
        else {
            continueConfig.slashCommands.push({
                ...cmd,
                source: "config-ts-slash-command",
            });
        }
    }
    if (config.systemMessage) {
        continueConfig.rules.unshift({
            rule: config.systemMessage,
            source: "json-systemMessage",
        });
    }
    // Trigger MCP server refreshes (Config is reloaded again once connected!)
    const mcpManager = MCPManagerSingleton_1.MCPManagerSingleton.getInstance();
    const orgPolicy = PolicySingleton_1.PolicySingleton.getInstance().policy;
    if (orgPolicy?.policy?.allowMcpServers === false) {
        await mcpManager.shutdown();
    }
    else {
        const mcpOptions = (config.experimental?.modelContextProtocolServers ?? []).map((server, index) => ({
            id: `continue-mcp-server-${index + 1}`,
            name: `MCP Server`,
            requestOptions: (0, config_yaml_1.mergeConfigYamlRequestOptions)(server.transport.type !== "stdio"
                ? server.transport.requestOptions
                : undefined, config.requestOptions),
            ...server.transport,
        }));
        const { errors: jsonMcpErrors, mcpServers } = await (0, loadJsonMcpConfigs_1.loadJsonMcpConfigs)(ide, true, config.requestOptions);
        errors.push(...jsonMcpErrors);
        mcpOptions.push(...mcpServers);
        mcpManager.setConnections(mcpOptions, false);
    }
    // Handle experimental modelRole config values for apply and edit
    const inlineEditModel = (0, util_2.getModelByRole)(continueConfig, "inlineEdit")?.title;
    if (inlineEditModel) {
        const match = continueConfig.modelsByRole.chat.find((m) => m.title === inlineEditModel);
        if (match) {
            continueConfig.selectedModelByRole.edit = match;
            continueConfig.modelsByRole.edit = [match]; // The only option if inlineEdit role is set
        }
        else {
            errors.push({
                fatal: false,
                message: `experimental.modelRoles.inlineEdit model title ${inlineEditModel} not found in models array`,
            });
        }
    }
    const applyBlockModel = (0, util_2.getModelByRole)(continueConfig, "applyCodeBlock")?.title;
    if (applyBlockModel) {
        const match = continueConfig.modelsByRole.chat.find((m) => m.title === applyBlockModel);
        if (match) {
            continueConfig.selectedModelByRole.apply = match;
            continueConfig.modelsByRole.apply = [match]; // The only option if applyCodeBlock role is set
        }
        else {
            errors.push({
                fatal: false,
                message: `experimental.modelRoles.applyCodeBlock model title ${inlineEditModel} not found in models array`,
            });
        }
    }
    // Add transformers JS to the embed models list if not already added
    if (ideInfo.ideType === "vscode" &&
        !continueConfig.modelsByRole.embed.find((m) => m.providerName === "transformers.js")) {
        continueConfig.modelsByRole.embed.push(new TransformersJsEmbeddingsProvider_1.default());
    }
    return { config: continueConfig, errors };
}
function llmToSerializedModelDescription(llm) {
    return {
        provider: llm.providerName,
        underlyingProviderName: llm.underlyingProviderName,
        model: llm.model,
        title: llm.title ?? llm.model,
        apiKey: llm.apiKey,
        apiBase: llm.apiBase,
        contextLength: llm.contextLength,
        template: llm.template,
        completionOptions: llm.completionOptions,
        baseAgentSystemMessage: llm.baseAgentSystemMessage,
        basePlanSystemMessage: llm.basePlanSystemMessage,
        baseChatSystemMessage: llm.baseChatSystemMessage,
        requestOptions: llm.requestOptions,
        promptTemplates: (0, util_2.serializePromptTemplates)(llm.promptTemplates),
        capabilities: llm.capabilities,
        roles: llm.roles,
        configurationStatus: llm.getConfigurationStatus(),
        apiKeyLocation: llm.apiKeyLocation,
        envSecretLocations: llm.envSecretLocations,
        sourceFile: llm.sourceFile,
        isFromAutoDetect: llm.isFromAutoDetect,
    };
}
async function finalToBrowserConfig(final, ide) {
    return {
        allowAnonymousTelemetry: final.allowAnonymousTelemetry,
        completionOptions: final.completionOptions,
        slashCommands: final.slashCommands?.map(({ run, ...rest }) => ({
            ...rest,
            isLegacy: !!run,
        })),
        contextProviders: final.contextProviders?.map((c) => c.description),
        disableIndexing: final.disableIndexing,
        disableSessionTitles: final.disableSessionTitles,
        userToken: final.userToken,
        ui: final.ui,
        experimental: final.experimental,
        rules: final.rules,
        docs: final.docs,
        tools: final.tools.map(tools_1.serializeTool),
        mcpServerStatuses: final.mcpServerStatuses,
        tabAutocompleteOptions: final.tabAutocompleteOptions,
        usePlatform: await (0, env_1.useHub)(ide.getIdeSettings()),
        modelsByRole: Object.fromEntries(Object.entries(final.modelsByRole).map(([k, v]) => [
            k,
            v.map(llmToSerializedModelDescription),
        ])), // TODO better types here
        selectedModelByRole: Object.fromEntries(Object.entries(final.selectedModelByRole).map(([k, v]) => [
            k,
            v ? llmToSerializedModelDescription(v) : null,
        ])), // TODO better types here
        // data not included here because client doesn't need
    };
}
function escapeSpacesInPath(p) {
    return p.replace(/ /g, "\\ ");
}
async function handleEsbuildInstallation(ide, _ideType) {
    // Only check when config.ts is going to be used; never auto-install.
    const installCmd = "npm i esbuild@x.x.x --prefix ~/.continue";
    // Try to detect a user-installed esbuild (normal resolution)
    try {
        await Promise.resolve().then(() => __importStar(require("esbuild")));
        return true; // available
    }
    catch {
        // Try resolving from ~/.continue/node_modules as a courtesy
        try {
            const userEsbuild = path_1.default.join(os_1.default.homedir(), ".continue", "node_modules", "esbuild");
            const candidate = require.resolve("esbuild", { paths: [userEsbuild] });
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require(candidate);
            return true; // available via ~/.continue
        }
        catch {
            // Not available → show friendly instructions and opt out of building
            await ide.showToast("error", [
                "config.ts has been deprecated and esbuild is no longer automatically installed by Continue.",
                "To use config.ts, install esbuild manually:",
                "",
                `    ${installCmd}`,
            ].join("\n"));
            return false;
        }
    }
}
async function tryBuildConfigTs() {
    try {
        if (process.env.IS_BINARY === "true") {
            await buildConfigTsWithBinary();
        }
        else {
            await buildConfigTsWithNodeModule();
        }
    }
    catch (e) {
        console.log(`Build error. Please check your ~/.continue/config.ts file: ${e}`);
    }
}
async function buildConfigTsWithBinary() {
    const cmd = [
        escapeSpacesInPath((0, paths_1.getEsbuildBinaryPath)()),
        escapeSpacesInPath((0, paths_1.getConfigTsPath)()),
        "--bundle",
        `--outfile=${escapeSpacesInPath((0, paths_1.getConfigJsPath)())}`,
        "--platform=node",
        "--format=cjs",
        "--sourcemap",
        "--external:fetch",
        "--external:fs",
        "--external:path",
        "--external:os",
        "--external:child_process",
    ].join(" ");
    (0, child_process_1.execSync)(cmd);
}
async function buildConfigTsWithNodeModule() {
    const { build } = await Promise.resolve().then(() => __importStar(require("esbuild")));
    await build({
        entryPoints: [(0, paths_1.getConfigTsPath)()],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: (0, paths_1.getConfigJsPath)(),
        external: ["fetch", "fs", "path", "os", "child_process"],
        sourcemap: true,
    });
}
function readConfigJs() {
    const configJsPath = (0, paths_1.getConfigJsPath)();
    if (!fs.existsSync(configJsPath)) {
        return undefined;
    }
    return fs.readFileSync(configJsPath, "utf8");
}
async function buildConfigTsandReadConfigJs(ide, ideType) {
    const configTsPath = (0, paths_1.getConfigTsPath)();
    if (!fs.existsSync(configTsPath)) {
        return;
    }
    const currentContent = fs.readFileSync(configTsPath, "utf8");
    // If the user hasn't modified the default config.ts, don't bother building
    if (currentContent.trim() === paths_1.DEFAULT_CONFIG_TS_CONTENTS.trim()) {
        return;
    }
    // Only bother with esbuild if config.ts is actually customized
    if (currentContent.trim() !== paths_1.DEFAULT_CONFIG_TS_CONTENTS.trim()) {
        const ok = await handleEsbuildInstallation(ide, ideType);
        if (!ok) {
            // esbuild not available → we already showed a friendly message; skip building
            return;
        }
        await tryBuildConfigTs();
    }
    return readConfigJs();
}
async function loadContinueConfigFromJson(ide, ideSettings, ideInfo, uniqueId, llmLogger, workOsAccessToken, overrideConfigJson) {
    const workspaceConfigs = await (0, loadRcConfigs_1.getWorkspaceRcConfigs)(ide);
    // Serialized config
    let { config: serialized, errors, configLoadInterrupted, } = loadSerializedConfig(workspaceConfigs, ideSettings, ideInfo.ideType, overrideConfigJson, ide);
    if (!serialized || configLoadInterrupted) {
        return { errors, config: undefined, configLoadInterrupted: true };
    }
    // Apply shared config
    // TODO: override several of these values with user/org shared config
    const sharedConfig = new GlobalContext_1.GlobalContext().getSharedConfig();
    const withShared = (0, sharedConfig_1.modifyAnyConfigWithSharedConfig)(serialized, sharedConfig);
    // Convert serialized to intermediate config
    let intermediate = await serializedToIntermediateConfig(withShared, ide);
    // Apply config.ts to modify intermediate config
    const configJsContents = await buildConfigTsandReadConfigJs(ide, ideInfo.ideType);
    if (configJsContents) {
        try {
            // Try config.ts first
            const configJsPath = (0, paths_1.getConfigJsPath)();
            let module;
            try {
                module = await Promise.resolve(`${configJsPath}`).then(s => __importStar(require(s)));
            }
            catch (e) {
                console.log(e);
                console.log("Could not load config.ts as absolute path, retrying as file url ...");
                try {
                    module = await Promise.resolve(`${(0, pathToUri_1.localPathToUri)(configJsPath)}`).then(s => __importStar(require(s)));
                }
                catch (e) {
                    throw new Error("Could not load config.ts as file url either", {
                        cause: e,
                    });
                }
            }
            if (typeof require !== "undefined") {
                delete require.cache[require.resolve(configJsPath)];
            }
            if (!module.modifyConfig) {
                throw new Error("config.ts does not export a modifyConfig function.");
            }
            intermediate = module.modifyConfig(intermediate);
        }
        catch (e) {
            console.log("Error loading config.ts: ", e);
        }
    }
    // Apply remote config.js to modify intermediate config
    if (ideSettings.remoteConfigServerUrl) {
        try {
            const configJsPathForRemote = (0, paths_1.getConfigJsPathForRemote)(ideSettings.remoteConfigServerUrl);
            const module = await Promise.resolve(`${configJsPathForRemote}`).then(s => __importStar(require(s)));
            if (typeof require !== "undefined") {
                delete require.cache[require.resolve(configJsPathForRemote)];
            }
            if (!module.modifyConfig) {
                throw new Error("config.ts does not export a modifyConfig function.");
            }
            intermediate = module.modifyConfig(intermediate);
        }
        catch (e) {
            console.log("Error loading remotely set config.js: ", e);
        }
    }
    // Convert to final config format
    const { config: finalConfig, errors: finalErrors } = await intermediateToFinalConfig({
        config: intermediate,
        ide,
        ideSettings,
        ideInfo,
        uniqueId,
        llmLogger,
        workOsAccessToken,
    });
    return {
        config: finalConfig,
        errors: [...(errors ?? []), ...finalErrors],
        configLoadInterrupted: false,
    };
}
//# sourceMappingURL=load.js.map