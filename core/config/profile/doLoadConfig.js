"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = doLoadConfig;
const fs_1 = __importDefault(require("fs"));
const mcpSlashCommand_1 = require("../../commands/slash/mcpSlashCommand");
const ruleBlockSlashCommand_1 = require("../../commands/slash/ruleBlockSlashCommand");
const MCPManagerSingleton_1 = require("../../context/mcp/MCPManagerSingleton");
const MCPContextProvider_1 = __importDefault(require("../../context/providers/MCPContextProvider"));
const env_js_1 = require("../../control-plane/env.js");
const PolicySingleton_1 = require("../../control-plane/PolicySingleton");
const TeamAnalytics_js_1 = require("../../control-plane/TeamAnalytics.js");
const initPrompt_1 = require("../../promptFiles/initPrompt");
const tools_1 = require("../../tools");
const callTool_1 = require("../../tools/callTool");
const mcpToolName_1 = require("../../tools/mcpToolName");
const GlobalContext_1 = require("../../util/GlobalContext");
const paths_1 = require("../../util/paths");
const pathToUri_1 = require("../../util/pathToUri");
const posthog_1 = require("../../util/posthog");
const SentryLogger_1 = require("../../util/sentry/SentryLogger");
const tts_1 = require("../../util/tts");
const getWorkspaceContinueRuleDotFiles_1 = require("../getWorkspaceContinueRuleDotFiles");
const load_1 = require("../load");
const loadCodebaseRules_1 = require("../markdown/loadCodebaseRules");
const loadMarkdownRules_1 = require("../markdown/loadMarkdownRules");
const migrateSharedConfig_1 = require("../migrateSharedConfig");
const selectedModels_1 = require("../selectedModels");
const loadYaml_1 = require("../yaml/loadYaml");
async function loadRules(ide) {
    const rules = [];
    const errors = [];
    // Add rules from .continuerules files
    const { rules: yamlRules, errors: continueRulesErrors } = await (0, getWorkspaceContinueRuleDotFiles_1.getWorkspaceContinueRuleDotFiles)(ide);
    rules.unshift(...yamlRules);
    errors.push(...continueRulesErrors);
    // Add rules from markdown files in .continue/rules
    const { rules: markdownRules, errors: markdownRulesErrors } = await (0, loadMarkdownRules_1.loadMarkdownRules)(ide);
    rules.unshift(...markdownRules);
    errors.push(...markdownRulesErrors);
    // Add colocated rules from CodebaseRulesCache
    const codebaseRulesCache = loadCodebaseRules_1.CodebaseRulesCache.getInstance();
    rules.unshift(...codebaseRulesCache.rules);
    errors.push(...codebaseRulesCache.errors);
    return { rules, errors };
}
async function doLoadConfig(options) {
    const { ide, controlPlaneClient, llmLogger, overrideConfigJson, overrideConfigYaml, profileId, overrideConfigYamlByPath, orgScopeId, packageIdentifier, } = options;
    const ideInfo = await ide.getIdeInfo();
    const uniqueId = await ide.getUniqueId();
    const ideSettings = await ide.getIdeSettings();
    const workOsAccessToken = await controlPlaneClient.getAccessToken();
    const isSignedIn = await controlPlaneClient.isSignedIn();
    // Migrations for old config files
    // Removes
    const configJsonPath = (0, paths_1.getConfigJsonPath)();
    if (fs_1.default.existsSync(configJsonPath)) {
        (0, migrateSharedConfig_1.migrateJsonSharedConfig)(configJsonPath, ide);
    }
    const configYamlPath = (0, pathToUri_1.localPathOrUriToPath)(overrideConfigYamlByPath || (0, paths_1.getConfigYamlPath)(ideInfo.ideType));
    let newConfig;
    let errors;
    let configLoadInterrupted = false;
    if (overrideConfigYaml || fs_1.default.existsSync(configYamlPath)) {
        const result = await (0, loadYaml_1.loadContinueConfigFromYaml)({
            ide,
            ideSettings,
            ideInfo,
            uniqueId,
            llmLogger,
            overrideConfigYaml,
            controlPlaneClient,
            orgScopeId,
            packageIdentifier,
            workOsAccessToken,
        });
        newConfig = result.config;
        errors = result.errors;
        configLoadInterrupted = result.configLoadInterrupted;
    }
    else {
        const result = await (0, load_1.loadContinueConfigFromJson)(ide, ideSettings, ideInfo, uniqueId, llmLogger, workOsAccessToken, overrideConfigJson);
        newConfig = result.config;
        errors = result.errors;
        configLoadInterrupted = result.configLoadInterrupted;
    }
    if (configLoadInterrupted || !newConfig) {
        return { errors, config: newConfig, configLoadInterrupted: true };
    }
    // TODO using config result but result with non-fatal errors is an antipattern?
    // Remove ability have undefined errors, just have an array
    errors = [...(errors ?? [])];
    // Load rules and always include the RulesContextProvider
    const { rules, errors: rulesErrors } = await loadRules(ide);
    errors.push(...rulesErrors);
    newConfig.rules.unshift(...rules);
    // Convert invokable rules to slash commands
    for (const rule of newConfig.rules) {
        if (rule.invokable) {
            try {
                const slashCommand = (0, ruleBlockSlashCommand_1.convertRuleBlockToSlashCommand)(rule);
                (newConfig.slashCommands ?? (newConfig.slashCommands = [])).push(slashCommand);
            }
            catch (e) {
                errors.push({
                    message: `Error converting invokable rule ${rule.name} to slash command: ${e instanceof Error ? e.message : e}`,
                    fatal: false,
                });
            }
        }
    }
    newConfig.slashCommands.push(initPrompt_1.initSlashCommand);
    const proxyContextProvider = newConfig.contextProviders?.find((cp) => cp.description.title === "continue-proxy");
    if (proxyContextProvider) {
        proxyContextProvider.workOsAccessToken =
            workOsAccessToken;
    }
    // Show deprecation warnings for providers
    const globalContext = new GlobalContext_1.GlobalContext();
    newConfig.contextProviders.forEach((provider) => {
        if (provider.deprecationMessage) {
            const providerTitle = provider.description.title;
            const shownWarnings = globalContext.get("shownDeprecatedProviderWarnings") ?? {};
            if (!shownWarnings[providerTitle]) {
                void ide.showToast("warning", provider.deprecationMessage);
                globalContext.update("shownDeprecatedProviderWarnings", {
                    ...shownWarnings,
                    [providerTitle]: true,
                });
            }
        }
    });
    // Rectify model selections for each role
    newConfig = (0, selectedModels_1.rectifySelectedModelsFromGlobalContext)(newConfig, profileId);
    // Add things from MCP servers
    const mcpManager = MCPManagerSingleton_1.MCPManagerSingleton.getInstance();
    const mcpServerStatuses = mcpManager.getStatuses();
    const serializableStatuses = mcpServerStatuses.map((server) => {
        const { client, ...rest } = server;
        return rest;
    });
    newConfig.mcpServerStatuses = serializableStatuses;
    for (const server of mcpServerStatuses) {
        server.errors.forEach((error) => {
            // MCP errors will also show as config loading errors
            errors.push({
                fatal: false,
                message: error,
            });
        });
        if (server.status === "connected") {
            const serverTools = server.tools.map((tool) => ({
                displayTitle: server.name + " " + tool.name,
                function: {
                    description: tool.description,
                    name: (0, mcpToolName_1.getMCPToolName)(server, tool),
                    parameters: tool.inputSchema,
                },
                faviconUrl: server.faviconUrl,
                readonly: false,
                type: "function",
                uri: (0, callTool_1.encodeMCPToolUri)(server.id, tool.name),
                group: server.name,
                originalFunctionName: tool.name,
            }));
            newConfig.tools.push(...serverTools);
            // Fetch MCP prompt content during config load
            const serverSlashCommands = await Promise.all(server.prompts.map(async (prompt) => {
                let promptContent;
                try {
                    // Fetch the actual prompt content from the MCP server
                    const mcpPromptResponse = await mcpManager.getPrompt(server.name, prompt.name, {});
                    promptContent = (0, mcpSlashCommand_1.stringifyMcpPrompt)(mcpPromptResponse);
                }
                catch (error) {
                    console.warn(`Failed to fetch MCP prompt content for ${prompt.name} from server ${server.name}:`, error);
                    // Keep promptContent as undefined so the UI can show a fallback
                }
                return {
                    name: prompt.name,
                    description: prompt.description ?? "MCP Prompt",
                    source: "mcp-prompt",
                    isLegacy: false,
                    prompt: promptContent, // Store the actual prompt content
                    mcpServerName: server.name, // Used in client to retrieve prompt
                    mcpArgs: prompt.arguments,
                };
            }));
            newConfig.slashCommands.push(...serverSlashCommands);
            const submenuItems = server.resources
                .map((resource) => ({
                title: resource.name,
                description: resource.description ?? resource.name,
                id: resource.uri,
                icon: server.faviconUrl,
            }))
                .concat(server.resourceTemplates.map((template) => ({
                title: template.name,
                description: template.description ?? template.name,
                id: template.uriTemplate,
                icon: server.faviconUrl,
            })));
            if (submenuItems.length > 0) {
                const serverContextProvider = new MCPContextProvider_1.default({
                    submenuItems,
                    mcpId: server.id,
                    serverName: server.name,
                });
                newConfig.contextProviders.push(serverContextProvider);
            }
        }
    }
    newConfig.tools.push(...(0, tools_1.getConfigDependentToolDefinitions)({
        rules: newConfig.rules,
        enableExperimentalTools: newConfig.experimental?.enableExperimentalTools ?? false,
        isSignedIn,
        isRemote: await ide.isWorkspaceRemote(),
        modelName: newConfig.selectedModelByRole.chat?.model,
    }));
    // Detect duplicate tool names
    const counts = {};
    newConfig.tools.forEach((tool) => {
        if (counts[tool.function.name]) {
            counts[tool.function.name] = counts[tool.function.name] + 1;
        }
        else {
            counts[tool.function.name] = 1;
        }
    });
    Object.entries(counts).forEach(([toolName, count]) => {
        if (count > 1) {
            errors.push({
                fatal: false,
                message: `Duplicate (${count}) tools named "${toolName}" detected. Permissions will conflict and usage may be unpredictable`,
            });
        }
    });
    const ruleCounts = {};
    newConfig.rules.forEach((rule) => {
        if (rule.name) {
            if (ruleCounts[rule.name]) {
                ruleCounts[rule.name] = ruleCounts[rule.name] + 1;
            }
            else {
                ruleCounts[rule.name] = 1;
            }
        }
    });
    Object.entries(ruleCounts).forEach(([ruleName, count]) => {
        if (count > 1) {
            errors.push({
                fatal: false,
                message: `Duplicate (${count}) rules named "${ruleName}" detected. This may cause unexpected behavior`,
            });
        }
    });
    // VS Code has an IDE telemetry setting
    // Since it's a security concern we use OR behavior on false
    if (newConfig.allowAnonymousTelemetry !== false &&
        ideInfo.ideType === "vscode") {
        if ((await ide.isTelemetryEnabled()) === false) {
            newConfig.allowAnonymousTelemetry = false;
        }
    }
    // Org policies
    const policy = PolicySingleton_1.PolicySingleton.getInstance().policy?.policy;
    if (policy?.allowAnonymousTelemetry === false) {
        newConfig.allowAnonymousTelemetry = false;
    }
    if (policy?.allowCodebaseIndexing === false) {
        newConfig.disableIndexing = true;
    }
    // Setup telemetry only after (and if) we know it is enabled
    await posthog_1.Telemetry.setup(newConfig.allowAnonymousTelemetry ?? true, await ide.getUniqueId(), ideInfo);
    // Setup Sentry logger with same telemetry settings
    // TODO: Remove Continue team member check once Sentry is ready for all users
    let userEmail;
    try {
        // Access the session info to get user email for Continue team member check
        const sessionInfo = await controlPlaneClient.sessionInfoPromise;
        userEmail = sessionInfo?.account?.id;
    }
    catch (error) {
        // Ignore errors getting session info, will default to no Sentry
    }
    await SentryLogger_1.SentryLogger.setup(newConfig.allowAnonymousTelemetry ?? false, await ide.getUniqueId(), ideInfo, userEmail);
    // TODO: pass config to pre-load non-system TTS models
    await tts_1.TTS.setup();
    // Set up control plane proxy if configured
    const controlPlane = newConfig.controlPlane;
    const useOnPremProxy = controlPlane?.useContinueForTeamsProxy === false && controlPlane?.proxyUrl;
    const env = await (0, env_js_1.getControlPlaneEnv)(Promise.resolve(ideSettings));
    let controlPlaneProxyUrl = useOnPremProxy
        ? controlPlane?.proxyUrl
        : env.DEFAULT_CONTROL_PLANE_PROXY_URL;
    if (!controlPlaneProxyUrl.endsWith("/")) {
        controlPlaneProxyUrl += "/";
    }
    const controlPlaneProxyInfo = {
        profileId,
        controlPlaneProxyUrl,
        workOsAccessToken,
    };
    if (newConfig.analytics) {
        // FIXME before re-enabling TeamAnalytics.setup() populate workspaceId in
        //   controlPlaneProxyInfo to prevent /proxy/analytics/undefined/capture calls
        //   where undefined is :workspaceId
        // await TeamAnalytics.setup(
        //   newConfig.analytics,
        //   uniqueId,
        //   ideInfo.extensionVersion,
        //   controlPlaneClient,
        //   controlPlaneProxyInfo,
        // );
    }
    else {
        await TeamAnalytics_js_1.TeamAnalytics.shutdown();
    }
    newConfig = await injectControlPlaneProxyInfo(newConfig, controlPlaneProxyInfo);
    return { config: newConfig, errors, configLoadInterrupted: false };
}
// Pass ControlPlaneProxyInfo to objects that need it
async function injectControlPlaneProxyInfo(config, info) {
    Object.keys(config.modelsByRole).forEach((key) => {
        config.modelsByRole[key].forEach((model) => {
            if (model.providerName === "continue-proxy") {
                model.controlPlaneProxyInfo = info;
            }
        });
    });
    Object.keys(config.selectedModelByRole).forEach((key) => {
        const model = config.selectedModelByRole[key];
        if (model?.providerName === "continue-proxy") {
            model.controlPlaneProxyInfo = info;
        }
    });
    config.modelsByRole.chat.forEach((model) => {
        if (model.providerName === "continue-proxy") {
            model.controlPlaneProxyInfo = info;
        }
    });
    return config;
}
//# sourceMappingURL=doLoadConfig.js.map