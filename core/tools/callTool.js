"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeMCPToolUri = encodeMCPToolUri;
exports.decodeMCPToolUri = decodeMCPToolUri;
exports.callBuiltInTool = callBuiltInTool;
exports.callTool = callTool;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const MCPManagerSingleton_1 = require("../context/mcp/MCPManagerSingleton");
const errors_1 = require("../util/errors");
const url_1 = require("../util/url");
const builtIn_1 = require("./builtIn");
const codebaseTool_1 = require("./implementations/codebaseTool");
const createNewFile_1 = require("./implementations/createNewFile");
const createRuleBlock_1 = require("./implementations/createRuleBlock");
const fetchUrlContent_1 = require("./implementations/fetchUrlContent");
const globSearch_1 = require("./implementations/globSearch");
const grepSearch_1 = require("./implementations/grepSearch");
const lsTool_1 = require("./implementations/lsTool");
const readCurrentlyOpenFile_1 = require("./implementations/readCurrentlyOpenFile");
const readFile_1 = require("./implementations/readFile");
const readFileRange_1 = require("./implementations/readFileRange");
const requestRule_1 = require("./implementations/requestRule");
const runTerminalCommand_1 = require("./implementations/runTerminalCommand");
const searchWeb_1 = require("./implementations/searchWeb");
const viewDiff_1 = require("./implementations/viewDiff");
const viewRepoMap_1 = require("./implementations/viewRepoMap");
const viewSubdirectory_1 = require("./implementations/viewSubdirectory");
const parseArgs_1 = require("./parseArgs");
async function callHttpTool(url, args, extras) {
    const response = await extras.fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            arguments: args,
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Failed to call tool at ${url}:\n${JSON.stringify(data)}`);
    }
    return data.output;
}
function encodeMCPToolUri(mcpId, toolName) {
    return `mcp://${encodeURIComponent(mcpId)}/${encodeURIComponent(toolName)}`;
}
function decodeMCPToolUri(uri) {
    const url = new URL(uri);
    if (url.protocol !== "mcp:") {
        return null;
    }
    return [
        decodeURIComponent(url.hostname),
        decodeURIComponent(url.pathname).slice(1), // to remove leading '/'
    ];
}
async function callToolFromUri(uri, args, extras) {
    const parseable = (0, url_1.canParseUrl)(uri);
    if (!parseable) {
        throw new Error(`Invalid URI: ${uri}`);
    }
    const parsedUri = new URL(uri);
    switch (parsedUri?.protocol) {
        case "http:":
        case "https:":
            return callHttpTool(uri, args, extras);
        case "mcp:":
            const decoded = decodeMCPToolUri(uri);
            if (!decoded) {
                throw new Error(`Invalid MCP tool URI: ${uri}`);
            }
            const [mcpId, toolName] = decoded;
            const client = MCPManagerSingleton_1.MCPManagerSingleton.getInstance().getConnection(mcpId);
            if (!client) {
                throw new Error("MCP connection not found");
            }
            const response = await client.client.callTool({
                name: toolName,
                arguments: args,
            }, types_js_1.CallToolResultSchema, { timeout: client.options.timeout });
            if (response.isError === true) {
                throw new Error(JSON.stringify(response.content));
            }
            const contextItems = [];
            response.content.forEach((item) => {
                if (item.type === "text") {
                    contextItems.push({
                        name: extras.tool.displayTitle,
                        description: "Tool output",
                        content: item.text,
                        icon: extras.tool.faviconUrl,
                    });
                }
                else if (item.type === "resource") {
                    // TODO resource change subscribers https://modelcontextprotocol.io/docs/concepts/resources
                    if (item.resource?.blob) {
                        contextItems.push({
                            name: extras.tool.displayTitle,
                            description: "MCP Item Error",
                            content: "Error: tool call received unsupported blob resource item",
                            icon: extras.tool.faviconUrl,
                        });
                    }
                    // TODO account for mimetype? // const mimeType = item.resource.mimeType
                    // const uri = item.resource.uri;
                    contextItems.push({
                        name: extras.tool.displayTitle,
                        description: "Tool output",
                        content: item.resource.text,
                        icon: extras.tool.faviconUrl,
                    });
                }
                else {
                    contextItems.push({
                        name: extras.tool.displayTitle,
                        description: "MCP Item Error",
                        content: `Error: tool call received unsupported item of type "${item.type}"`,
                        icon: extras.tool.faviconUrl,
                    });
                }
            });
            return contextItems;
        default:
            throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
    }
}
async function callBuiltInTool(functionName, args, extras) {
    switch (functionName) {
        case builtIn_1.BuiltInToolNames.ReadFile:
            return await (0, readFile_1.readFileImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.ReadFileRange:
            return await (0, readFileRange_1.readFileRangeImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.CreateNewFile:
            return await (0, createNewFile_1.createNewFileImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.GrepSearch:
            return await (0, grepSearch_1.grepSearchImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.FileGlobSearch:
            return await (0, globSearch_1.fileGlobSearchImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.RunTerminalCommand:
            return await (0, runTerminalCommand_1.runTerminalCommandImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.SearchWeb:
            return await (0, searchWeb_1.searchWebImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.FetchUrlContent:
            return await (0, fetchUrlContent_1.fetchUrlContentImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.ViewDiff:
            return await (0, viewDiff_1.viewDiffImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.LSTool:
            return await (0, lsTool_1.lsToolImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.ReadCurrentlyOpenFile:
            return await (0, readCurrentlyOpenFile_1.readCurrentlyOpenFileImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.CreateRuleBlock:
            return await (0, createRuleBlock_1.createRuleBlockImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.RequestRule:
            return await (0, requestRule_1.requestRuleImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.CodebaseTool:
            return await (0, codebaseTool_1.codebaseToolImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.ViewRepoMap:
            return await (0, viewRepoMap_1.viewRepoMapImpl)(args, extras);
        case builtIn_1.BuiltInToolNames.ViewSubdirectory:
            return await (0, viewSubdirectory_1.viewSubdirectoryImpl)(args, extras);
        default:
            throw new Error(`Tool "${functionName}" not found`);
    }
}
// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
// Note: Edit tool is handled on client
async function callTool(tool, toolCall, extras) {
    try {
        const args = (0, parseArgs_1.safeParseToolCallArgs)(toolCall);
        const contextItems = tool.uri
            ? await callToolFromUri(tool.uri, args, extras)
            : await callBuiltInTool(tool.function.name, args, extras);
        if (tool.faviconUrl) {
            contextItems.forEach((item) => {
                item.icon = tool.faviconUrl;
            });
        }
        return {
            contextItems,
            errorMessage: undefined,
        };
    }
    catch (e) {
        let errorMessage = `${e}`;
        let errorReason;
        if (e instanceof errors_1.ContinueError) {
            errorMessage = e.message;
            errorReason = e.reason;
        }
        else if (e instanceof Error) {
            errorMessage = e.message;
        }
        return {
            contextItems: [],
            errorMessage,
            errorReason,
        };
    }
}
//# sourceMappingURL=callTool.js.map