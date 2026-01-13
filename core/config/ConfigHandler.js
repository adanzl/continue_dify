"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigHandler = void 0;
const client_js_1 = require("../control-plane/client.js");
const GlobalContext_js_1 = require("../util/GlobalContext.js");
const node_events_1 = __importDefault(require("node:events"));
const AuthTypes_js_1 = require("../control-plane/AuthTypes.js");
const env_js_1 = require("../control-plane/env.js");
const PolicySingleton_js_1 = require("../control-plane/PolicySingleton.js");
const Logger_js_1 = require("../util/Logger.js");
const posthog_js_1 = require("../util/posthog.js");
const loadLocalAssistants_js_1 = require("./loadLocalAssistants.js");
const LocalProfileLoader_js_1 = __importDefault(require("./profile/LocalProfileLoader.js"));
const PlatformProfileLoader_js_1 = __importDefault(require("./profile/PlatformProfileLoader.js"));
const ProfileLifecycleManager_js_1 = require("./ProfileLifecycleManager.js");
class ConfigHandler {
    abortCascade() {
        this.cascadeAbortController.abort();
        this.cascadeAbortController = new AbortController();
    }
    constructor(ide, llmLogger, initialSessionInfoPromise) {
        this.ide = ide;
        this.llmLogger = llmLogger;
        this.globalContext = new GlobalContext_js_1.GlobalContext();
        this.organizations = [];
        this.totalConfigReloads = 0;
        this.workspaceDirs = null;
        this.PERSONAL_ORG_DESC = {
            iconUrl: "",
            id: "personal",
            name: "Personal",
            slug: undefined,
        };
        this.updateListeners = [];
        // Ancient method of adding custom providers through vs code
        this.additionalContextProviders = [];
        this.controlPlaneClient = new client_js_1.ControlPlaneClient(initialSessionInfoPromise, this.ide);
        // This profile manager will always be available
        this.globalLocalProfileManager = new ProfileLifecycleManager_js_1.ProfileLifecycleManager(new LocalProfileLoader_js_1.default(ide, this.controlPlaneClient, this.llmLogger), this.ide);
        this.currentOrg = null;
        this.currentProfile = null;
        this.organizations = [];
        this.initter = new node_events_1.default();
        this.isInitialized = new Promise((resolve) => {
            this.initter.on("init", resolve);
        });
        this.cascadeAbortController = new AbortController();
        void this.cascadeInit("Config handler initialization");
    }
    async getWorkspaceId() {
        if (!this.workspaceDirs) {
            this.workspaceDirs = await this.ide.getWorkspaceDirs();
        }
        return this.workspaceDirs.join("&");
    }
    async getProfileKey(orgId) {
        const workspaceId = await this.getWorkspaceId();
        return `${workspaceId}:::${orgId}`;
    }
    async cascadeInit(reason, isLogin) {
        const signal = this.cascadeAbortController.signal;
        this.workspaceDirs = null; // forces workspace dirs reload
        // Always update globalLocalProfileManager before recreating all the loaders
        // during every cascadeInit so it holds the most recent controlPlaneClient.
        this.globalLocalProfileManager = new ProfileLifecycleManager_js_1.ProfileLifecycleManager(new LocalProfileLoader_js_1.default(this.ide, this.controlPlaneClient, this.llmLogger), this.ide);
        try {
            const { orgs, errors } = await this.getOrgs();
            // Figure out selected org
            const workspaceId = await this.getWorkspaceId();
            const selectedOrgs = this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
            let currentSelection = selectedOrgs[workspaceId];
            // reset personal org to first available non-personal org on login
            if (isLogin && currentSelection === "personal") {
                currentSelection = null;
            }
            const firstNonPersonal = orgs.find((org) => org.id !== this.PERSONAL_ORG_DESC.id);
            const fallback = firstNonPersonal ?? orgs[0] ?? null;
            let selectedOrg;
            if (currentSelection) {
                const match = orgs.find((org) => org.id === currentSelection);
                if (match) {
                    selectedOrg = match;
                }
                else {
                    selectedOrg = fallback;
                }
            }
            else {
                selectedOrg = fallback;
            }
            if (signal.aborted) {
                return; // local only case, no`fetch to throw abort error
            }
            this.globalContext.update("lastSelectedOrgIdForWorkspace", {
                ...selectedOrgs,
                [workspaceId]: selectedOrg?.id,
            });
            this.organizations = orgs;
            this.currentOrg = selectedOrg;
            this.currentProfile = selectedOrg?.currentProfile;
            await this.reloadConfig(reason, errors);
        }
        catch (e) {
            if (signal.aborted) {
                return;
            }
            else {
                this.initter.emit("init"); // Error case counts as init
                throw e;
            }
        }
    }
    async getOrgs() {
        const errors = [];
        const isSignedIn = await this.controlPlaneClient.isSignedIn();
        if (isSignedIn) {
            try {
                // TODO use policy returned with org, not policy endpoint
                const policyResponse = await this.controlPlaneClient.getPolicy();
                PolicySingleton_js_1.PolicySingleton.getInstance().policy = policyResponse;
                const orgDescriptions = await this.controlPlaneClient.listOrganizations();
                const orgsWithPolicy = orgDescriptions.map((d) => ({
                    ...d,
                    policy: policyResponse?.policy,
                }));
                if (policyResponse?.policy?.allowOtherOrgs === false) {
                    if (orgsWithPolicy.length === 0) {
                        return { orgs: [] };
                    }
                    else {
                        const firstOrg = await this.getNonPersonalHubOrg(orgsWithPolicy[0]);
                        return { orgs: [firstOrg] };
                    }
                }
                const orgs = await Promise.all([
                    this.getPersonalHubOrg(),
                    ...orgsWithPolicy.map((org) => this.getNonPersonalHubOrg(org)),
                ]);
                // TODO make try/catch more granular here, to catch specific org errors
                return { orgs };
            }
            catch (e) {
                errors.push({
                    fatal: false,
                    message: `Error loading Continue Hub assistants${e instanceof Error ? ":\n" + e.message : ""}`,
                });
            }
        }
        else {
            PolicySingleton_js_1.PolicySingleton.getInstance().policy = null;
        }
        // Load local org if not signed in or hub orgs fail
        try {
            const orgs = [await this.getLocalOrg()];
            return { orgs };
        }
        catch (e) {
            errors.push({
                fatal: true,
                message: `Error loading local assistants${e instanceof Error ? ":\n" + e.message : ""}`,
            });
            return {
                orgs: [],
                errors,
            };
        }
    }
    getSerializedOrgs() {
        return this.organizations.map((org) => ({
            iconUrl: org.iconUrl,
            id: org.id,
            name: org.name,
            slug: org.slug,
            profiles: org.profiles.map((profile) => profile.profileDescription),
            selectedProfileId: org.currentProfile?.profileDescription.id || null,
        }));
    }
    async getHubProfiles(orgScopeId) {
        const assistants = await this.controlPlaneClient.listAssistants(orgScopeId);
        return await Promise.all(assistants.map(async (assistant) => {
            const profileLoader = await PlatformProfileLoader_js_1.default.create({
                configResult: {
                    ...assistant.configResult,
                    config: assistant.configResult.config,
                },
                ownerSlug: assistant.ownerSlug,
                packageSlug: assistant.packageSlug,
                iconUrl: assistant.iconUrl,
                versionSlug: assistant.configResult.config?.version ?? "latest",
                controlPlaneClient: this.controlPlaneClient,
                ide: this.ide,
                llmLogger: this.llmLogger,
                rawYaml: assistant.rawYaml,
                orgScopeId: orgScopeId,
            });
            return new ProfileLifecycleManager_js_1.ProfileLifecycleManager(profileLoader, this.ide);
        }));
    }
    async getNonPersonalHubOrg(org) {
        const localProfiles = await this.getLocalProfiles({
            includeGlobal: false,
            includeWorkspace: true,
        });
        const profiles = [...(await this.getHubProfiles(org.id)), ...localProfiles];
        return this.rectifyProfilesForOrg(org, profiles);
    }
    async getPersonalHubOrg() {
        const localProfiles = await this.getLocalProfiles({
            includeGlobal: true,
            includeWorkspace: true,
        });
        const hubProfiles = await this.getHubProfiles(null);
        const profiles = [...hubProfiles, ...localProfiles];
        return this.rectifyProfilesForOrg(this.PERSONAL_ORG_DESC, profiles);
    }
    async getLocalOrg() {
        const localProfiles = await this.getLocalProfiles({
            includeGlobal: true,
            includeWorkspace: true,
        });
        return this.rectifyProfilesForOrg(this.PERSONAL_ORG_DESC, localProfiles);
    }
    async rectifyProfilesForOrg(org, profiles) {
        const profileKey = await this.getProfileKey(org.id);
        const selectedProfiles = this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
        const currentSelection = selectedProfiles[profileKey];
        const firstNonLocal = profiles.find((profile) => profile.profileDescription.profileType !== "local");
        const fallback = firstNonLocal ?? (profiles.length > 0 ? profiles[0] : null);
        let currentProfile;
        if (currentSelection) {
            const match = profiles.find((profile) => profile.profileDescription.id === currentSelection);
            if (match) {
                currentProfile = match;
            }
            else {
                currentProfile = fallback;
            }
        }
        else {
            currentProfile = fallback;
        }
        if (currentProfile) {
            this.globalContext.update("lastSelectedProfileForWorkspace", {
                ...selectedProfiles,
                [profileKey]: currentProfile.profileDescription.id,
            });
        }
        return {
            ...org,
            profiles,
            currentProfile,
        };
    }
    async getLocalProfiles(options) {
        /**
         * Users can define as many local agents as they want in a `.continue/agents` (or previous .continue/assistants) folder
         */
        // Local customization disabled for on-premise deployments
        const env = await (0, env_js_1.getControlPlaneEnv)(this.ide.getIdeSettings());
        if (env.AUTH_TYPE === AuthTypes_js_1.AuthType.OnPrem) {
            return [];
        }
        const localProfiles = [];
        if (options.includeGlobal) {
            localProfiles.push(this.globalLocalProfileManager);
        }
        if (options.includeWorkspace) {
            const assistantFiles = await (0, loadLocalAssistants_js_1.getAllDotContinueDefinitionFiles)(this.ide, options, "assistants");
            const agentFiles = await (0, loadLocalAssistants_js_1.getAllDotContinueDefinitionFiles)(this.ide, options, "agents");
            const profiles = [...assistantFiles, ...agentFiles].map((assistant) => {
                return new LocalProfileLoader_js_1.default(this.ide, this.controlPlaneClient, this.llmLogger, assistant);
            });
            const localAssistantProfiles = profiles.map((profile) => new ProfileLifecycleManager_js_1.ProfileLifecycleManager(profile, this.ide));
            localProfiles.push(...localAssistantProfiles);
        }
        return localProfiles;
    }
    //////////////////
    // External actions that can cause a cascading config refresh
    // Should not be used internally
    //////////////////
    async refreshAll(reason) {
        await this.cascadeInit(reason ?? "External refresh all");
    }
    // Ide settings change: refresh session and cascade refresh from the top
    async updateIdeSettings(ideSettings) {
        this.abortCascade();
        await this.cascadeInit("IDE settings update");
    }
    // Session change: refresh session and cascade refresh from the top
    async updateControlPlaneSessionInfo(sessionInfo) {
        const currentSession = await this.controlPlaneClient.sessionInfoPromise;
        const newSession = sessionInfo;
        let reload = false;
        let isLogin = false;
        if (newSession) {
            if (currentSession) {
                if (newSession.AUTH_TYPE !== AuthTypes_js_1.AuthType.OnPrem &&
                    currentSession.AUTH_TYPE !== AuthTypes_js_1.AuthType.OnPrem) {
                    if (newSession.account.id !== currentSession.account.id) {
                        // session id change (non-on-prem)
                        reload = true;
                    }
                }
            }
            else {
                // log in
                reload = true;
                isLogin = true;
            }
        }
        else {
            if (currentSession) {
                // log out
                reload = true;
            }
        }
        if (reload) {
            this.controlPlaneClient = new client_js_1.ControlPlaneClient(Promise.resolve(sessionInfo), this.ide);
            this.abortCascade();
            await this.cascadeInit("Control plane session info update", isLogin);
        }
        return reload;
    }
    // Org id: check id validity, save selection, switch and reload
    async setSelectedOrgId(orgId, profileId) {
        if (orgId === this.currentOrg?.id) {
            return;
        }
        const org = this.organizations.find((org) => org.id === orgId);
        if (!org) {
            throw new Error(`Org ${orgId} not found`);
        }
        const workspaceId = await this.getWorkspaceId();
        const selectedOrgs = this.globalContext.get("lastSelectedOrgIdForWorkspace") ?? {};
        this.globalContext.update("lastSelectedOrgIdForWorkspace", {
            ...selectedOrgs,
            [workspaceId]: org.id,
        });
        this.currentOrg = org;
        if (profileId) {
            await this.setSelectedProfileId(profileId);
        }
        else {
            this.currentProfile = org.currentProfile;
            await this.reloadConfig("Selected org changed");
        }
    }
    // Profile id: check id validity, save selection, switch and reload
    async setSelectedProfileId(profileId) {
        if (!this.currentOrg) {
            throw new Error(`No org selected`);
        }
        if (this.currentProfile &&
            profileId === this.currentProfile.profileDescription.id) {
            return;
        }
        const profile = this.currentOrg.profiles.find((profile) => profile.profileDescription.id === profileId);
        if (!profile) {
            throw new Error(`Profile ${profileId} not found in current org`);
        }
        const profileKey = await this.getProfileKey(this.currentOrg.id);
        const selectedProfiles = this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
        this.globalContext.update("lastSelectedProfileForWorkspace", {
            ...selectedProfiles,
            [profileKey]: profileId,
        });
        this.currentProfile = profile;
        await this.reloadConfig("Selected profile changed");
    }
    // Bottom level of cascade: refresh the current profile
    // IMPORTANT - must always refresh when switching profiles
    // Because of e.g. MCP singleton and docs service using things from config
    // Could improve this
    async reloadConfig(reason, injectErrors) {
        const startTime = performance.now();
        this.totalConfigReloads += 1;
        // console.log(`Reloading config (#${this.totalConfigLoads}): ${reason}`); // Uncomment to see config loading logs
        if (!this.currentProfile) {
            const out = {
                config: undefined,
                errors: injectErrors,
                configLoadInterrupted: true,
            };
            this.notifyConfigListeners(out);
            return out;
        }
        for (const org of this.organizations) {
            for (const profile of org.profiles) {
                if (profile.profileDescription.id !==
                    this.currentProfile.profileDescription.id) {
                    profile.clearConfig();
                }
            }
        }
        const { config, errors = [], configLoadInterrupted, } = await this.currentProfile.reloadConfig(this.additionalContextProviders);
        if (injectErrors) {
            errors.unshift(...injectErrors);
        }
        this.notifyConfigListeners({ config, errors, configLoadInterrupted });
        this.initter.emit("init");
        // Track config loading telemetry
        const endTime = performance.now();
        const duration = endTime - startTime;
        const isSignedIn = await this.controlPlaneClient.isSignedIn();
        const profileDescription = this.currentProfile.profileDescription;
        const telemetryData = {
            duration,
            reason,
            totalConfigLoads: this.totalConfigReloads,
            configLoadInterrupted,
            profileType: profileDescription.profileType,
            isPersonalOrg: this.currentOrg?.id === this.PERSONAL_ORG_DESC.id,
            errorCount: errors.length,
            isSignedIn,
        };
        void posthog_js_1.Telemetry.capture("config_reload", telemetryData);
        if (errors.length) {
            Logger_js_1.Logger.error("Errors loading config: ", errors);
        }
        return {
            config,
            errors: errors.length ? errors : undefined,
            configLoadInterrupted,
        };
    }
    // Listeners setup - can listen to current profile updates
    notifyConfigListeners(result) {
        for (const listener of this.updateListeners) {
            listener(result);
        }
    }
    onConfigUpdate(listener) {
        this.updateListeners.push(listener);
    }
    // Methods for loading (without reloading) config
    // Serialized for passing to GUI
    // Load for just awaiting current config load promise for the profile
    async getSerializedConfig() {
        if (!this.currentProfile) {
            return {
                config: undefined,
                errors: undefined,
                configLoadInterrupted: true,
            };
        }
        return await this.currentProfile.getSerializedConfig(this.additionalContextProviders);
    }
    async loadConfig() {
        if (!this.currentProfile) {
            return {
                config: undefined,
                errors: undefined,
                configLoadInterrupted: true,
            };
        }
        await this.isInitialized;
        const config = await this.currentProfile.loadConfig(this.additionalContextProviders);
        return config;
    }
    async openConfigProfile(profileId, element) {
        let openProfileId = profileId || this.currentProfile?.profileDescription.id;
        if (!openProfileId) {
            return;
        }
        const profile = this.currentOrg?.profiles.find((p) => p.profileDescription.id === openProfileId);
        if (!profile) {
            console.error(`Profile ${profileId} not found`);
            return;
        }
        if (profile.profileDescription.profileType === "local") {
            const configFile = element?.sourceFile ?? profile.profileDescription.uri;
            await this.ide.openFile(configFile);
        }
        else {
            const env = await (0, env_js_1.getControlPlaneEnv)(this.ide.getIdeSettings());
            await this.ide.openUrl(`${env.APP_URL}${openProfileId}`);
        }
    }
    registerCustomContextProvider(contextProvider) {
        this.additionalContextProviders.push(contextProvider);
        void this.reloadConfig("Custom context provider registered");
    }
    /**
     * Retrieves the titles of additional context providers that are of type "submenu".
     *
     * @returns {string[]} An array of titles of the additional context providers that have a description type of "submenu".
     */
    getAdditionalSubmenuContextProviders() {
        return this.additionalContextProviders
            .filter((provider) => provider.description.type === "submenu")
            .map((provider) => provider.description.title);
    }
}
exports.ConfigHandler = ConfigHandler;
//# sourceMappingURL=ConfigHandler.js.map