"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPManagerSingleton = void 0;
const MCPConnection_1 = __importDefault(require("./MCPConnection"));
class MCPManagerSingleton {
    constructor() {
        this.connections = new Map();
        this.abortController = new AbortController();
    }
    static getInstance() {
        if (!MCPManagerSingleton.instance) {
            MCPManagerSingleton.instance = new MCPManagerSingleton();
        }
        return MCPManagerSingleton.instance;
    }
    async setEnabled(serverId, enabled) {
        const conn = this.connections.get(serverId);
        if (conn) {
            if (enabled) {
                conn.status = "not-connected";
                await this.refreshConnection(serverId);
            }
            else {
                try {
                    await conn.disconnect(true);
                }
                catch (e) {
                    console.error(`Error disconnecting from MCP server ${serverId}`, e);
                }
            }
        }
    }
    createConnection(id, options) {
        if (this.connections.has(id)) {
            return this.connections.get(id);
        }
        else {
            const connection = new MCPConnection_1.default(options);
            this.connections.set(id, connection);
            return connection;
        }
    }
    getConnection(id) {
        return this.connections.get(id);
    }
    async shutdown() {
        if (this.connections.size > 0) {
            await Promise.allSettled(Array.from(this.connections.entries()).map(([id, connection]) => {
                try {
                    connection.abortController.abort();
                    void connection.client.close();
                }
                finally {
                    this.connections.delete(id);
                }
            }));
        }
    }
    setConnections(servers, forceRefresh, extras) {
        let refresh = false;
        // Remove any connections that are no longer in config
        Array.from(this.connections.entries()).forEach(([id, connection]) => {
            if (!servers.find(
            // Refresh the connection if TransportOptions changed
            (s) => s.id === id && this.compareTransportOptions(connection.options, s))) {
                refresh = true;
                connection.abortController.abort();
                void connection.client.close();
                this.connections.delete(id);
            }
        });
        // Add any connections that are not yet in manager
        servers.forEach((server) => {
            if (this.connections.has(server.id)) {
                const conn = this.connections.get(server.id);
                if (conn) {
                    // We need to update it. Some attributes may have changed, such as name, faviconUrl, etc.
                    conn.options = server;
                }
            }
            else {
                refresh = true;
                this.connections.set(server.id, new MCPConnection_1.default(server, extras));
            }
        });
        // NOTE the id is made by stringifying the options
        if (refresh) {
            void this.refreshConnections(forceRefresh);
        }
    }
    compareTransportOptions(a, b) {
        if (a.type !== b.type) {
            return false;
        }
        if ("command" in a && "command" in b) {
            return (a.command === b.command &&
                JSON.stringify(a.args) === JSON.stringify(b.args) &&
                this.compareEnv(a.env, b.env));
        }
        else if ("url" in a && "url" in b) {
            return a.url === b.url;
        }
        return false;
    }
    compareEnv(aEnv, bEnv) {
        const a = aEnv ?? {};
        const b = bEnv ?? {};
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        return (aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]));
    }
    async refreshConnection(serverId) {
        const connection = this.connections.get(serverId);
        if (!connection) {
            throw new Error(`MCP Connection ${serverId} not found`);
        }
        await connection.connectClient(true, this.abortController.signal);
        if (this.onConnectionsRefreshed) {
            this.onConnectionsRefreshed();
        }
    }
    async refreshConnections(force) {
        this.abortController.abort();
        this.abortController = new AbortController();
        await Promise.race([
            new Promise((resolve) => {
                this.abortController.signal.addEventListener("abort", () => {
                    resolve(undefined);
                });
            }),
            (async () => {
                await Promise.all(Array.from(this.connections.values()).map(async (connection) => {
                    await connection.connectClient(force, this.abortController.signal);
                }));
                if (this.onConnectionsRefreshed) {
                    this.onConnectionsRefreshed();
                }
            })(),
        ]);
    }
    getStatuses() {
        return Array.from(this.connections.values()).map((connection) => ({
            ...connection.getStatus(),
            client: connection.client,
        }));
    }
    setStatus(serverId, status) {
        this.connections.get(serverId).status = status;
    }
    async getPrompt(serverName, promptName, args = {}) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Error getting prompt: MCP Connection ${serverName} not found`);
        }
        return await connection.client.getPrompt({
            name: promptName,
            arguments: args,
        });
    }
}
exports.MCPManagerSingleton = MCPManagerSingleton;
//# sourceMappingURL=MCPManagerSingleton.js.map