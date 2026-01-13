"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlPlaneClient = exports.TRIAL_PROXY_URL = void 0;
const config_yaml_1 = require("@continuedev/config-yaml");
const node_fetch_1 = __importDefault(require("node-fetch"));
const Logger_js_1 = require("../util/Logger.js");
const AuthTypes_js_1 = require("./AuthTypes.js");
const env_js_1 = require("./env.js");
exports.TRIAL_PROXY_URL = "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app";
class ControlPlaneClient {
    constructor(sessionInfoPromise, ide) {
        this.sessionInfoPromise = sessionInfoPromise;
        this.ide = ide;
    }
    async resolveFQSNs(fqsns, orgScopeId) {
        if (!(await this.isSignedIn())) {
            return fqsns.map((fqsn) => ({
                found: false,
                fqsn,
                secretLocation: {
                    secretName: fqsn.secretName,
                    secretType: config_yaml_1.SecretType.NotFound,
                },
            }));
        }
        const resp = await this.requestAndHandleError("ide/sync-secrets", {
            method: "POST",
            body: JSON.stringify({ fqsns, orgScopeId }),
        });
        return (await resp.json());
    }
    async isSignedIn() {
        const sessionInfo = await this.sessionInfoPromise;
        return !!sessionInfo;
    }
    async getAccessToken() {
        const sessionInfo = await this.sessionInfoPromise;
        return (0, AuthTypes_js_1.isOnPremSession)(sessionInfo) ? undefined : sessionInfo?.accessToken;
    }
    async request(path, init) {
        const sessionInfo = await this.sessionInfoPromise;
        const onPremSession = (0, AuthTypes_js_1.isOnPremSession)(sessionInfo);
        const accessToken = await this.getAccessToken();
        // Bearer token not necessary for on-prem auth type
        if (!accessToken && !onPremSession) {
            throw new Error("No access token");
        }
        const env = await (0, env_js_1.getControlPlaneEnv)(this.ide.getIdeSettings());
        const url = new URL(path, env.CONTROL_PLANE_URL).toString();
        const ideInfo = await this.ide.getIdeInfo();
        const resp = await (0, node_fetch_1.default)(url, {
            ...init,
            headers: {
                ...init.headers,
                Authorization: `Bearer ${accessToken}`,
                ...{
                    "x-extension-version": ideInfo.extensionVersion,
                    "x-is-prerelease": String(ideInfo.isPrerelease),
                },
            },
        });
        return resp;
    }
    async requestAndHandleError(path, init) {
        const resp = await this.request(path, init);
        if (!resp.ok) {
            throw new Error(`Control plane request failed: ${resp.status} ${await resp.text()}`);
        }
        return resp;
    }
    async listAssistants(organizationId) {
        if (!(await this.isSignedIn())) {
            return [];
        }
        try {
            const url = organizationId
                ? `ide/list-assistants?organizationId=${organizationId}`
                : "ide/list-assistants";
            const resp = await this.requestAndHandleError(url, {
                method: "GET",
            });
            return (await resp.json());
        }
        catch (e) {
            // Capture control plane API failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "control_plane_list_assistants",
                organizationId,
            });
            return [];
        }
    }
    async listOrganizations() {
        if (!(await this.isSignedIn())) {
            return [];
        }
        // We try again here because when users sign up with an email domain that is
        // captured by an org, we need to wait for the user account creation webhook to
        // take effect. Otherwise the organization(s) won't show up.
        // This error manifests as a 404 (user not found)
        let retries = 0;
        const maxRetries = 10;
        const maxWaitTime = 20000; // 20 seconds in milliseconds
        while (retries < maxRetries) {
            const resp = await this.request("ide/list-organizations", {
                method: "GET",
            });
            if (resp.status === 404) {
                retries++;
                if (retries >= maxRetries) {
                    console.warn(`Failed to list organizations after ${maxRetries} retries: user not found`);
                    return [];
                }
                const waitTime = Math.min(Math.pow(2, retries) * 100, maxWaitTime / maxRetries);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                continue;
            }
            else if (!resp.ok) {
                console.warn(`Failed to list organizations (${resp.status}): ${await resp.text()}`);
                return [];
            }
            const { organizations } = (await resp.json());
            return organizations;
        }
        // This should never be reached due to the while condition, but adding for safety
        console.warn(`Failed to list organizations after ${maxRetries} retries: maximum attempts exceeded`);
        return [];
    }
    async listAssistantFullSlugs(organizationId) {
        if (!(await this.isSignedIn())) {
            return null;
        }
        const url = organizationId
            ? `ide/list-assistant-full-slugs?organizationId=${organizationId}`
            : "ide/list-assistant-full-slugs";
        try {
            const resp = await this.requestAndHandleError(url, {
                method: "GET",
            });
            const { fullSlugs } = (await resp.json());
            return fullSlugs;
        }
        catch (e) {
            // Capture control plane API failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "control_plane_list_assistant_slugs",
                organizationId,
            });
            return null;
        }
    }
    async getPolicy() {
        if (!(await this.isSignedIn())) {
            return null;
        }
        try {
            const resp = await this.request(`ide/policy`, {
                method: "GET",
            });
            return (await resp.json());
        }
        catch (e) {
            return null;
        }
    }
    async getCreditStatus() {
        if (!(await this.isSignedIn())) {
            return null;
        }
        try {
            const resp = await this.requestAndHandleError("ide/credits", {
                method: "GET",
            });
            return (await resp.json());
        }
        catch (e) {
            // Capture control plane API failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "control_plane_credit_status",
            });
            return null;
        }
    }
    /**
     * JetBrains does not support deep links, so we only check for `vsCodeUriScheme`
     * @param vsCodeUriScheme
     * @returns
     */
    async getModelsAddOnCheckoutUrl(vsCodeUriScheme) {
        if (!(await this.isSignedIn())) {
            return null;
        }
        try {
            const params = new URLSearchParams({
                // LocalProfileLoader ID
                profile_id: "local",
            });
            if (vsCodeUriScheme) {
                params.set("vscode_uri_scheme", vsCodeUriScheme);
            }
            const resp = await this.requestAndHandleError(`ide/get-models-add-on-checkout-url?${params.toString()}`, {
                method: "GET",
            });
            return (await resp.json());
        }
        catch (e) {
            // Capture control plane API failures to Sentry
            Logger_js_1.Logger.error(e, {
                context: "control_plane_models_checkout_url",
                vsCodeUriScheme,
            });
            return null;
        }
    }
    /**
     * Check if remote sessions should be enabled based on feature flags
     */
    async shouldEnableRemoteSessions() {
        // Check if user is signed in
        if (!(await this.isSignedIn())) {
            return false;
        }
        try {
            const sessionInfo = await this.sessionInfoPromise;
            if ((0, AuthTypes_js_1.isOnPremSession)(sessionInfo) || !sessionInfo) {
                return false;
            }
            return true;
        }
        catch (e) {
            Logger_js_1.Logger.error(e, {
                context: "control_plane_check_remote_sessions_enabled",
            });
            return false;
        }
    }
    /**
     * Get current user's session info
     */
    async getSessionInfo() {
        return await this.sessionInfoPromise;
    }
    /**
     * Fetch remote agents/sessions from the control plane
     */
    async listRemoteSessions() {
        if (!(await this.isSignedIn())) {
            return [];
        }
        try {
            const resp = await this.requestAndHandleError("agents/devboxes", {
                method: "GET",
            });
            const agents = (await resp.json());
            return agents.map((agent) => ({
                sessionId: `remote-${agent.id}`,
                title: agent.name || "Remote Agent",
                dateCreated: new Date(agent.create_time_ms).toISOString(),
                workspaceDirectory: "",
                isRemote: true,
                remoteId: agent.id,
            }));
        }
        catch (e) {
            // Log error but don't throw - remote sessions are optional
            Logger_js_1.Logger.error(e, {
                context: "control_plane_list_remote_sessions",
            });
            return [];
        }
    }
    async loadRemoteSession(remoteId) {
        if (!(await this.isSignedIn())) {
            throw new Error("Not signed in to load remote session");
        }
        try {
            // First get the tunnel URL for the remote agent
            const tunnelResp = await this.requestAndHandleError(`agents/devboxes/${remoteId}/tunnel`, {
                method: "POST",
            });
            const tunnelData = (await tunnelResp.json());
            const tunnelUrl = tunnelData.url;
            if (!tunnelUrl) {
                throw new Error(`Failed to get tunnel URL for agent ${remoteId}`);
            }
            // Now fetch the session state from the remote agent's /state endpoint
            const stateResponse = await (0, node_fetch_1.default)(`${tunnelUrl}/state`);
            if (!stateResponse.ok) {
                throw new Error(`Failed to fetch state from remote agent: ${stateResponse.statusText}`);
            }
            const remoteState = (await stateResponse.json());
            // The remote state contains a session property with the full session data
            if (!remoteState.session) {
                throw new Error("Remote agent returned invalid state - no session found");
            }
            return remoteState.session;
        }
        catch (e) {
            Logger_js_1.Logger.error(e, {
                context: "control_plane_load_remote_session",
                remoteId,
            });
            throw new Error(`Failed to load remote session: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
    }
    /**
     * Create a new background agent
     */
    async createBackgroundAgent(prompt, repoUrl, name, branch, organizationId, contextItems, selectedCode, agent) {
        if (!(await this.isSignedIn())) {
            throw new Error("Not signed in to Continue");
        }
        const requestBody = {
            prompt,
            repoUrl,
            name,
            branchName: branch,
        };
        if (organizationId) {
            requestBody.organizationId = organizationId;
        }
        // Include context items if provided
        if (contextItems && contextItems.length > 0) {
            requestBody.contextItems = contextItems.map((item) => ({
                content: item.content,
                description: item.description,
                name: item.name,
                uri: item.uri,
            }));
        }
        // Include selected code if provided
        if (selectedCode && selectedCode.length > 0) {
            requestBody.selectedCode = selectedCode.map((code) => ({
                filepath: code.filepath,
                range: code.range,
                contents: code.contents,
            }));
        }
        // Include agent configuration if provided
        if (agent) {
            requestBody.agent = agent;
        }
        const resp = await this.requestAndHandleError("agents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });
        return (await resp.json());
    }
    /**
     * List all background agents for the current user or organization
     * @param organizationId - Optional organization ID to filter agents by organization scope
     * @param limit - Optional limit for number of agents to return (default: 5)
     */
    async listBackgroundAgents(organizationId, limit) {
        if (!(await this.isSignedIn())) {
            return { agents: [], totalCount: 0 };
        }
        try {
            // Build URL with query parameters
            const params = new URLSearchParams();
            if (organizationId) {
                params.set("organizationId", organizationId);
            }
            if (limit !== undefined) {
                params.set("limit", limit.toString());
            }
            const url = `agents${params.toString() ? `?${params.toString()}` : ""}`;
            const resp = await this.requestAndHandleError(url, {
                method: "GET",
            });
            const result = (await resp.json());
            return {
                agents: result.agents.map((agent) => ({
                    id: agent.id,
                    name: agent.name,
                    status: agent.status,
                    repoUrl: agent.repoUrl,
                    createdAt: agent.createdAt,
                    metadata: {
                        github_repo: agent.metadata.github_repo,
                    },
                })),
                totalCount: result.totalCount,
            };
        }
        catch (e) {
            Logger_js_1.Logger.error(e, {
                context: "control_plane_list_background_agents",
            });
            return { agents: [], totalCount: 0 };
        }
    }
    /**
     * Get the full agent session information
     * @param agentSessionId - The ID of the agent session
     * @returns The agent session view including metadata and status
     */
    async getAgentSession(agentSessionId) {
        if (!(await this.isSignedIn())) {
            return null;
        }
        try {
            const resp = await this.requestAndHandleError(`agents/${agentSessionId}`, {
                method: "GET",
            });
            return (await resp.json());
        }
        catch (e) {
            Logger_js_1.Logger.error(e, {
                context: "control_plane_get_agent_session",
                agentSessionId,
            });
            return null;
        }
    }
    /**
     * Get the state of a specific background agent
     * @param agentSessionId - The ID of the agent session
     * @returns The agent's session state including history, workspace, and branch
     */
    async getAgentState(agentSessionId) {
        if (!(await this.isSignedIn())) {
            return null;
        }
        try {
            const resp = await this.requestAndHandleError(`agents/${agentSessionId}/state`, {
                method: "GET",
            });
            const result = (await resp.json());
            return result;
        }
        catch (e) {
            Logger_js_1.Logger.error(e, {
                context: "control_plane_get_agent_state",
                agentSessionId,
            });
            return null;
        }
    }
}
exports.ControlPlaneClient = ControlPlaneClient;
//# sourceMappingURL=client.js.map