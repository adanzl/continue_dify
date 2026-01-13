"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configYamlToContinueConfig = configYamlToContinueConfig;
exports.loadContinueConfigFromYaml = loadContinueConfigFromYaml;
const config_yaml_1 = require("@continuedev/config-yaml");
const node_path_1 = require("node:path");
const MCPManagerSingleton_1 = require("../../context/mcp/MCPManagerSingleton");
const TransformersJsEmbeddingsProvider_1 = __importDefault(require("../../llm/llms/TransformersJsEmbeddingsProvider"));
const getPromptFiles_1 = require("../../promptFiles/getPromptFiles");
const GlobalContext_1 = require("../../util/GlobalContext");
const sharedConfig_1 = require("../sharedConfig");
const promptBlockSlashCommand_1 = require("../../commands/slash/promptBlockSlashCommand");
const promptFileSlashCommand_1 = require("../../commands/slash/promptFileSlashCommand");
const loadJsonMcpConfigs_1 = require("../../context/mcp/json/loadJsonMcpConfigs");
const env_1 = require("../../control-plane/env");
const PolicySingleton_1 = require("../../control-plane/PolicySingleton");
const tools_1 = require("../../tools");
const uri_1 = require("../../util/uri");
const loadContextProviders_1 = require("../loadContextProviders");
const loadLocalAssistants_1 = require("../loadLocalAssistants");
const loadLocalYamlBlocks_1 = require("./loadLocalYamlBlocks");
const LocalPlatformClient_1 = require("./LocalPlatformClient");
const models_1 = require("./models");
const yamlToContinueConfig_1 = require("./yamlToContinueConfig");
async function loadConfigYaml(options) {
    const { overrideConfigYaml, controlPlaneClient, orgScopeId, ideSettings, ide, packageIdentifier, } = options;
    // Add local .continue blocks
    const localBlockPromises = config_yaml_1.BLOCK_TYPES.map(async (blockType) => {
        const localBlocks = await (0, loadLocalAssistants_1.getAllDotContinueDefinitionFiles)(ide, { includeGlobal: true, includeWorkspace: true, fileExtType: "yaml" }, blockType);
        return localBlocks.map((b) => ({
            uriType: "file",
            fileUri: b.path,
        }));
    });
    const localPackageIdentifiers = (await Promise.all(localBlockPromises)).flat();
    // logger.info(
    //   `Loading config.yaml from ${JSON.stringify(packageIdentifier)} with root path ${rootPath}`,
    // );
    // Registry client is only used if local blocks are present, but logic same for hub/local assistants
    const getRegistryClient = async () => {
        const rootPath = packageIdentifier.uriType === "file"
            ? (0, node_path_1.dirname)((0, uri_1.getCleanUriPath)(packageIdentifier.fileUri))
            : undefined;
        return new config_yaml_1.RegistryClient({
            accessToken: await controlPlaneClient.getAccessToken(),
            apiBase: (0, env_1.getControlPlaneEnvSync)(ideSettings.continueTestEnvironment)
                .CONTROL_PLANE_URL,
            rootPath,
        });
    };
    const errors = [];
    let config;
    if (overrideConfigYaml) {
        config = overrideConfigYaml;
        if (localPackageIdentifiers.length > 0) {
            const unrolledLocal = await (0, loadLocalYamlBlocks_1.unrollLocalYamlBlocks)(localPackageIdentifiers, ide, await getRegistryClient(), orgScopeId, controlPlaneClient);
            if (unrolledLocal.errors) {
                errors.push(...unrolledLocal.errors);
            }
            if (unrolledLocal.config) {
                config = (0, config_yaml_1.mergeUnrolledAssistants)(config, unrolledLocal.config);
            }
        }
    }
    else {
        // This is how we allow use of blocks locally
        const unrollResult = await (0, config_yaml_1.unrollAssistant)(packageIdentifier, await getRegistryClient(), {
            renderSecrets: true,
            currentUserSlug: "",
            onPremProxyUrl: null,
            orgScopeId,
            platformClient: new LocalPlatformClient_1.LocalPlatformClient(orgScopeId, controlPlaneClient, ide),
            injectBlocks: localPackageIdentifiers,
        });
        config = unrollResult.config;
        if (unrollResult.errors) {
            errors.push(...unrollResult.errors);
        }
    }
    if (config && (0, config_yaml_1.isAssistantUnrolledNonNullable)(config)) {
        errors.push(...(0, config_yaml_1.validateConfigYaml)(config));
    }
    if (errors?.some((error) => error.fatal)) {
        return {
            errors,
            config: undefined,
            configLoadInterrupted: true,
        };
    }
    // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
    return {
        config,
        errors,
        configLoadInterrupted: false,
    };
}
async function configYamlToContinueConfig(options) {
    let { config, ide, ideInfo, uniqueId, llmLogger } = options;
    const localErrors = [];
    const continueConfig = {
        slashCommands: [],
        tools: (0, tools_1.getBaseToolDefinitions)(),
        mcpServerStatuses: [],
        contextProviders: [],
        modelsByRole: {
            chat: [],
            edit: [],
            apply: [],
            embed: [],
            autocomplete: [],
            rerank: [],
            summarize: [],
        },
        selectedModelByRole: {
            chat: null,
            edit: null, // not currently used
            apply: null,
            embed: null,
            autocomplete: null,
            rerank: null,
            summarize: null,
        },
        rules: [],
        requestOptions: { ...config.requestOptions },
    };
    // Right now, if there are any missing packages in the config, then we will just throw an error
    if (!(0, config_yaml_1.isAssistantUnrolledNonNullable)(config)) {
        return {
            config: continueConfig,
            errors: [
                {
                    message: "Failed to load config due to missing blocks, see which blocks are missing below",
                    fatal: true,
                },
            ],
        };
    }
    for (const rule of config.rules ?? []) {
        const convertedRule = (0, yamlToContinueConfig_1.convertYamlRuleToContinueRule)(rule);
        continueConfig.rules.push(convertedRule);
    }
    continueConfig.data = config.data?.map((d) => ({
        ...d,
        requestOptions: (0, config_yaml_1.mergeConfigYamlRequestOptions)(d.requestOptions, continueConfig.requestOptions),
    }));
    continueConfig.docs = config.docs?.map((doc) => ({
        title: doc.name,
        startUrl: doc.startUrl,
        rootUrl: doc.rootUrl,
        faviconUrl: doc.faviconUrl,
        useLocalCrawling: doc.useLocalCrawling,
        sourceFile: doc.sourceFile,
    }));
    // Prompt files -
    try {
        const promptFiles = await (0, getPromptFiles_1.getAllPromptFiles)(ide, undefined, true);
        promptFiles.forEach((file) => {
            try {
                const slashCommand = (0, promptFileSlashCommand_1.slashCommandFromPromptFile)(file.path, file.content);
                if (slashCommand) {
                    continueConfig.slashCommands?.push(slashCommand);
                }
            }
            catch (e) {
                localErrors.push({
                    fatal: false,
                    message: `Failed to convert prompt file ${file.path} to slash command: ${e instanceof Error ? e.message : e}`,
                });
            }
        });
    }
    catch (e) {
        localErrors.push({
            fatal: false,
            message: `Error loading local prompt files: ${e instanceof Error ? e.message : e}`,
        });
    }
    config.prompts?.forEach((prompt) => {
        try {
            const slashCommand = (0, promptBlockSlashCommand_1.convertPromptBlockToSlashCommand)(prompt);
            continueConfig.slashCommands?.push(slashCommand);
        }
        catch (e) {
            localErrors.push({
                message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
                fatal: false,
            });
        }
    });
    // Models
    let warnAboutFreeTrial = false;
    const defaultModelRoles = ["chat", "summarize", "apply", "edit"];
    for (const model of config.models ?? []) {
        model.roles = model.roles ?? defaultModelRoles; // Default to all 4 chat-esque roles if not specified
        if (model.provider === "free-trial") {
            warnAboutFreeTrial = true;
        }
        try {
            const llms = await (0, models_1.llmsFromModelConfig)({
                model,
                uniqueId,
                llmLogger,
                config: continueConfig,
            });
            if (model.roles?.includes("chat")) {
                continueConfig.modelsByRole.chat.push(...llms);
            }
            if (model.roles?.includes("summarize")) {
                continueConfig.modelsByRole.summarize.push(...llms);
            }
            if (model.roles?.includes("apply")) {
                continueConfig.modelsByRole.apply.push(...llms);
            }
            if (model.roles?.includes("edit")) {
                continueConfig.modelsByRole.edit.push(...llms);
            }
            if (model.roles?.includes("autocomplete")) {
                continueConfig.modelsByRole.autocomplete.push(...llms);
            }
            if (model.roles?.includes("embed")) {
                const { provider } = model;
                if (provider === "transformers.js") {
                    if (ideInfo.ideType === "vscode") {
                        continueConfig.modelsByRole.embed.push(new TransformersJsEmbeddingsProvider_1.default());
                    }
                    else {
                        localErrors.push({
                            fatal: false,
                            message: `Transformers.js embeddings provider not supported in this IDE.`,
                        });
                    }
                }
                else {
                    continueConfig.modelsByRole.embed.push(...llms);
                }
            }
            if (model.roles?.includes("rerank")) {
                continueConfig.modelsByRole.rerank.push(...llms);
            }
        }
        catch (e) {
            localErrors.push({
                fatal: false,
                message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
            });
        }
    }
    // Add transformers js to the embed models in vs code if not already added
    if (ideInfo.ideType === "vscode" &&
        !continueConfig.modelsByRole.embed.find((m) => m.providerName === "transformers.js")) {
        continueConfig.modelsByRole.embed.push(new TransformersJsEmbeddingsProvider_1.default());
    }
    if (warnAboutFreeTrial) {
        localErrors.push({
            fatal: false,
            message: "Model provider 'free-trial' is no longer supported, will be ignored.",
        });
    }
    const { providers, errors: contextErrors } = (0, loadContextProviders_1.loadConfigContextProviders)(config.context, !!config.docs?.length, ideInfo.ideType);
    continueConfig.contextProviders = providers;
    localErrors.push(...contextErrors);
    // Trigger MCP server refreshes (Config is reloaded again once connected!)
    const mcpManager = MCPManagerSingleton_1.MCPManagerSingleton.getInstance();
    const orgPolicy = PolicySingleton_1.PolicySingleton.getInstance().policy;
    if (orgPolicy?.policy?.allowMcpServers === false) {
        await mcpManager.shutdown();
    }
    else {
        const mcpOptions = (config.mcpServers ?? []).map((server) => (0, yamlToContinueConfig_1.convertYamlMcpConfigToInternalMcpOptions)(server, config.requestOptions));
        const { errors: jsonMcpErrors, mcpServers } = await (0, loadJsonMcpConfigs_1.loadJsonMcpConfigs)(ide, true, config.requestOptions);
        localErrors.push(...jsonMcpErrors);
        mcpOptions.push(...mcpServers);
        mcpManager.setConnections(mcpOptions, false, { ide });
    }
    return { config: continueConfig, errors: localErrors };
}
async function loadContinueConfigFromYaml(options) {
    const { ide, ideSettings, ideInfo, uniqueId, llmLogger, workOsAccessToken, overrideConfigYaml, controlPlaneClient, orgScopeId, packageIdentifier, } = options;
    const configYamlResult = await loadConfigYaml({
        overrideConfigYaml,
        controlPlaneClient,
        orgScopeId,
        ideSettings,
        ide,
        packageIdentifier,
    });
    if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
        return {
            errors: configYamlResult.errors,
            config: undefined,
            configLoadInterrupted: true,
        };
    }
    const { config: continueConfig, errors: localErrors } = await configYamlToContinueConfig({
        config: configYamlResult.config,
        ide,
        ideInfo,
        uniqueId,
        llmLogger,
        workOsAccessToken,
    });
    // Apply shared config
    // TODO: override several of these values with user/org shared config
    // Don't try catch this - has security implications and failure should be fatal
    const sharedConfig = new GlobalContext_1.GlobalContext().getSharedConfig();
    const withShared = (0, sharedConfig_1.modifyAnyConfigWithSharedConfig)(continueConfig, sharedConfig);
    if (withShared.allowAnonymousTelemetry === undefined) {
        withShared.allowAnonymousTelemetry = true;
    }
    return {
        config: withShared,
        errors: [...(configYamlResult.errors ?? []), ...localErrors],
        configLoadInterrupted: false,
    };
}
//# sourceMappingURL=loadYaml.js.map