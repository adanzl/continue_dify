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
exports.getOauthToken = getOauthToken;
exports.performAuth = performAuth;
exports.removeMCPAuth = removeMCPAuth;
const auth_js_1 = require("@modelcontextprotocol/sdk/client/auth.js");
const auth_js_2 = require("@modelcontextprotocol/sdk/shared/auth.js");
const http_1 = __importDefault(require("http"));
const url_1 = __importDefault(require("url"));
const uuid_1 = require("uuid");
const GlobalContext_1 = require("../../util/GlobalContext");
const authenticatingContexts = new Map();
// Map state parameters to server URLs for OAuth callback matching
const stateToServerUrl = new Map();
const PORT = 3000;
let serverInstance = null;
const createServerForOAuth = () => http_1.default.createServer((req, res) => {
    try {
        if (!req.url) {
            throw new Error("no url found");
        }
        const parsedUrl = url_1.default.parse(req.url, true);
        if (!parsedUrl.query["code"]) {
            throw new Error("no query params found");
        }
        const code = parsedUrl.query["code"];
        const state = parsedUrl.query["state"];
        void handleMCPOauthCode(code, state);
        const html = `
<!DOCTYPE html>
<html>
<head><title>Authentication Complete</title></head>
<body>Authentication Complete. You can close this page now.</body>
</html>`;
        res.writeHead(200, {
            "Content-Type": "text/html",
        });
        res.end(html);
    }
    catch (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end(`Unexpected redirect error:  ${error.message}`);
    }
});
class MCPConnectionOauthProvider {
    constructor(oauthServerUrl, ide) {
        this.oauthServerUrl = oauthServerUrl;
        this.ide = ide;
        this.globalContext = new GlobalContext_1.GlobalContext();
        // Set default redirect URL immediately for synchronous access
        this._redirectUrl = `http://localhost:${PORT}`;
        // Initialize actual redirect URL asynchronously
        this._redirectUrlInitialized = this._initializeRedirectUrl();
    }
    async _initializeRedirectUrl() {
        try {
            // If IDE supports getExternalUri (VS Code extension), use it for dynamic redirect URI
            if (this.ide.getExternalUri) {
                const localUri = `http://localhost:${PORT}`;
                const externalUri = await this.ide.getExternalUri(localUri);
                this._redirectUrl = externalUri;
            }
            // Otherwise keep the default localhost URL
        }
        catch (error) {
            console.error("Failed to initialize redirect URL:", error);
            // Keep default URL on error
        }
    }
    get redirectUrl() {
        // Always return a valid URL, even if initialization is pending
        return this._redirectUrl;
    }
    getRedirectUrlWithState(state) {
        // Add state parameter to redirect URL
        const urlObj = new URL(this._redirectUrl);
        urlObj.searchParams.set("state", state);
        return urlObj.toString();
    }
    async ensureRedirectUrl() {
        // Wait for initialization to complete before returning
        await this._redirectUrlInitialized;
        return this._redirectUrl;
    }
    get clientMetadata() {
        // Generate state parameter if needed
        const state = authenticatingContexts.get(this.oauthServerUrl)?.state;
        const redirectUri = state
            ? this.getRedirectUrlWithState(state)
            : this.redirectUrl;
        return {
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            client_name: "Continue Dev, Inc", // get this from package.json?
            client_uri: "https://continue.dev", // get this from package.json?
        };
    }
    _getOauthStorage(key) {
        return this.globalContext.get("mcpOauthStorage")?.[this.oauthServerUrl]?.[key];
    }
    _updateOauthStorage(key, value) {
        const existingStorage = this.globalContext.get("mcpOauthStorage") ?? {};
        const existingServerStorage = existingStorage[this.oauthServerUrl] ?? {};
        this.globalContext.update("mcpOauthStorage", {
            ...existingStorage,
            [this.oauthServerUrl]: {
                ...existingServerStorage,
                [key]: value,
            },
        });
    }
    _clearOauthStorage() {
        const existingStorage = this.globalContext.get("mcpOauthStorage") ?? {};
        delete existingStorage[this.oauthServerUrl];
        this.globalContext.update("mcpOauthStorage", existingStorage);
    }
    saveClientInformation(clientInformation) {
        this._updateOauthStorage("clientInformation", clientInformation);
    }
    async clientInformation() {
        const existingClientInformation = this._getOauthStorage("clientInformation");
        if (!existingClientInformation) {
            return undefined;
        }
        return await auth_js_2.OAuthClientInformationSchema.parseAsync(existingClientInformation);
    }
    async tokens() {
        const existingTokens = this._getOauthStorage("tokens");
        if (!existingTokens) {
            return undefined;
        }
        return await auth_js_2.OAuthTokensSchema.parseAsync(existingTokens);
    }
    saveTokens(tokens) {
        this._updateOauthStorage("tokens", tokens);
    }
    codeVerifier() {
        const existingCodeVerifier = this._getOauthStorage("codeVerifier");
        if (!existingCodeVerifier) {
            return "";
        }
        return existingCodeVerifier;
    }
    saveCodeVerifier(codeVerifier) {
        this._updateOauthStorage("codeVerifier", codeVerifier);
    }
    clear() {
        this._clearOauthStorage();
    }
    async redirectToAuthorization(authorizationUrl) {
        // Ensure redirect URL is initialized before proceeding
        await this.ensureRedirectUrl();
        // Only create and start local server if using localhost redirect
        // For web-based VS Code, the redirect will be handled by VS Code's built-in mechanism
        if (!this.ide.getExternalUri || this._redirectUrl.includes("localhost")) {
            if (!serverInstance) {
                serverInstance = createServerForOAuth();
            }
            if (!serverInstance.listening) {
                await new Promise((resolve, reject) => {
                    serverInstance.listen(PORT, () => {
                        console.debug(`Server started for MCP Oauth process at http://localhost:${PORT}/`);
                        resolve();
                    });
                    serverInstance.on("error", reject);
                });
            }
        }
        await this.ide.openUrl(authorizationUrl.toString());
    }
}
async function getOauthToken(mcpServerUrl, ide) {
    const authProvider = new MCPConnectionOauthProvider(mcpServerUrl, ide);
    const tokens = await authProvider.tokens();
    return tokens?.access_token;
}
/**
 * checks if the authentication is already done for the current server
 * if not, starts the authentication process by opening a webpage url
 */
async function performAuth(serverId, url, ide) {
    const authProvider = new MCPConnectionOauthProvider(url, ide);
    // Ensure redirect URL is ready before starting auth
    await authProvider.ensureRedirectUrl();
    // Generate a unique state parameter for this auth flow
    const state = (0, uuid_1.v4)();
    // Store context for this specific server with state
    authenticatingContexts.set(url, {
        serverId,
        ide,
        state,
    });
    // Map state to server URL for callback matching
    stateToServerUrl.set(state, url);
    try {
        return await (0, auth_js_1.auth)(authProvider, {
            serverUrl: url,
        });
    }
    catch (error) {
        // Clean up on error
        authenticatingContexts.delete(url);
        stateToServerUrl.delete(state);
        throw error;
    }
}
/**
 * handle the authentication code received from the oauth redirect
 */
async function handleMCPOauthCode(authorizationCode, state) {
    let serverUrl;
    let context;
    if (state) {
        // Use state parameter to find the correct server
        serverUrl = stateToServerUrl.get(state);
        if (serverUrl) {
            context = authenticatingContexts.get(serverUrl);
        }
    }
    else {
        // Fallback: if no state or single context, use the first one
        const contexts = Array.from(authenticatingContexts.entries());
        if (contexts.length === 1) {
            [serverUrl, context] = contexts[0];
        }
    }
    if (!context || !serverUrl) {
        console.error("No matching authenticating context found for state:", state);
        return;
    }
    const { ide, serverId } = context;
    try {
        if (!serverUrl) {
            throw new Error("No MCP server url found for authentication");
        }
        if (!authorizationCode) {
            throw new Error(`No MCP authorization code found for ${serverUrl}`);
        }
        // Close the server before processing auth
        if (serverInstance) {
            await new Promise((resolve) => {
                serverInstance.close(() => {
                    console.debug("Server for MCP Oauth process was closed");
                    serverInstance = null;
                    resolve();
                });
            });
        }
        const authProvider = new MCPConnectionOauthProvider(serverUrl, ide);
        await authProvider.ensureRedirectUrl();
        const authStatus = await (0, auth_js_1.auth)(authProvider, {
            serverUrl,
            authorizationCode,
        });
        if (authStatus === "AUTHORIZED") {
            const { MCPManagerSingleton } = await Promise.resolve().then(() => __importStar(require("./MCPManagerSingleton"))); // put dynamic import to avoid cyclic imports
            await MCPManagerSingleton.getInstance().refreshConnection(serverId);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("OAuth authorization failed:", errorMessage);
        if (context?.ide) {
            await context.ide.showToast("error", `OAuth failed: ${errorMessage}`);
        }
    }
    finally {
        // Always clean up the context and state mapping
        authenticatingContexts.delete(serverUrl);
        if (state) {
            stateToServerUrl.delete(state);
        }
    }
}
function removeMCPAuth(url, ide) {
    const authProvider = new MCPConnectionOauthProvider(url, ide);
    authProvider.clear();
}
//# sourceMappingURL=MCPOauth.js.map