"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
const MCPManagerSingleton_1 = require("../mcp/MCPManagerSingleton");
class MCPContextProvider extends __1.BaseContextProvider {
    get description() {
        return {
            title: `${MCPContextProvider.description.title}-${this.options["mcpId"]}`,
            displayTitle: this.options["serverName"]
                ? `${this.options["serverName"]} resources`
                : "MCP",
            renderInlineAs: "",
            description: "MCP Resources",
            type: "submenu",
        };
    }
    static encodeMCPResourceId(mcpId, uri) {
        return JSON.stringify({ mcpId, uri });
    }
    static decodeMCPResourceId(mcpResourceId) {
        return JSON.parse(mcpResourceId);
    }
    constructor(options) {
        super(options);
    }
    /**
     * Continue experimentally supports resource templates (https://modelcontextprotocol.io/docs/concepts/resources#resource-templates)
     * by allowing specifically just the "query" variable in the template, which we will update with the full input of the user in the input box
     */
    insertInputToUriTemplate(uri, query) {
        const TEMPLATE_VAR = "query";
        if (uri.includes(`{${TEMPLATE_VAR}}`)) {
            // Sending an empty string will result in an error, so we instead send "null"
            const queryOrNull = query.trim() === "" ? "null" : query;
            return uri.replace(`{${TEMPLATE_VAR}}`, encodeURIComponent(queryOrNull));
        }
        return uri;
    }
    async getContextItems(query, extras) {
        const { mcpId, uri } = MCPContextProvider.decodeMCPResourceId(query);
        const connection = MCPManagerSingleton_1.MCPManagerSingleton.getInstance().getConnection(mcpId);
        if (!connection) {
            throw new Error(`No MCP connection found for ${mcpId}`);
        }
        const { contents } = await connection.client.readResource({
            uri: this.insertInputToUriTemplate(uri, extras.fullInput),
        });
        return await Promise.all(contents.map(async (resource) => {
            if (!("text" in resource) || typeof resource.text !== "string") {
                throw new Error("Continue currently only supports text resources from MCP");
            }
            return {
                name: resource.uri,
                description: resource.uri,
                content: resource.text,
                uri: {
                    type: "url",
                    value: resource.uri,
                },
            };
        }));
    }
    async loadSubmenuItems(args) {
        return this.options.submenuItems.map((item) => ({
            ...item,
            id: JSON.stringify({
                mcpId: this.options.mcpId,
                uri: item.id,
            }),
        }));
    }
}
MCPContextProvider.description = {
    title: "mcp",
    displayTitle: "MCP",
    description: "MCP Resources",
    type: "submenu",
    renderInlineAs: "",
};
exports.default = MCPContextProvider;
//# sourceMappingURL=MCPContextProvider.js.map