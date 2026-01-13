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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileContent = getFileContent;
exports.findAvailableFilename = findAvailableFilename;
exports.createNewWorkspaceBlockFile = createNewWorkspaceBlockFile;
exports.createNewGlobalRuleFile = createNewGlobalRuleFile;
const config_yaml_1 = require("@continuedev/config-yaml");
const YAML = __importStar(require("yaml"));
const paths_1 = require("../../util/paths");
const pathToUri_1 = require("../../util/pathToUri");
const uri_1 = require("../../util/uri");
const BLOCK_TYPE_CONFIG = {
    context: { singular: "context", filename: "context" },
    models: { singular: "model", filename: "model" },
    rules: { singular: "rule", filename: "rule" },
    docs: { singular: "doc", filename: "doc" },
    prompts: { singular: "prompt", filename: "prompt" },
    mcpServers: { singular: "MCP server", filename: "mcp-server" },
    data: { singular: "data", filename: "data" },
};
function getContentsForNewBlock(blockType) {
    const configYaml = {
        name: `New ${BLOCK_TYPE_CONFIG[blockType]?.singular}`,
        version: "0.0.1",
        schema: "v1",
    };
    switch (blockType) {
        case "context":
            configYaml.context = [
                {
                    provider: "file",
                },
            ];
            break;
        case "models":
            configYaml.models = [
                {
                    provider: "anthropic",
                    model: "claude-sonnet-4-5",
                    apiKey: "${{ secrets.ANTHROPIC_API_KEY }}",
                    name: "Claude Sonnet 4.5",
                    roles: ["chat", "edit"],
                },
            ];
            break;
        case "rules":
            configYaml.rules = ["Always give concise responses"];
            break;
        case "docs":
            configYaml.docs = [
                {
                    name: "New docs",
                    startUrl: "https://docs.continue.dev",
                },
            ];
            break;
        case "prompts":
            configYaml.prompts = [
                {
                    name: "New prompt",
                    description: "New prompt",
                    prompt: "Please write a thorough suite of unit tests for this code, making sure to cover all relevant edge cases",
                },
            ];
            break;
        case "mcpServers":
            configYaml.mcpServers = [
                {
                    name: "New MCP server",
                    command: "npx",
                    args: ["-y", "<your-mcp-server>"],
                    env: {},
                },
            ];
            break;
    }
    return configYaml;
}
function getFileExtension(blockType) {
    if (blockType === "rules" || blockType === "prompts") {
        return "md";
    }
    return "yaml";
}
function getFileContent(blockType) {
    if (blockType === "rules") {
        return (0, config_yaml_1.createRuleMarkdown)("New Rule", "Your rule content", {
            description: "A description of your rule",
        });
    }
    else if (blockType === "prompts") {
        return (0, config_yaml_1.createPromptMarkdown)("New prompt", "Please write a thorough suite of unit tests for this code, making sure to cover all relevant edge cases", {
            description: "New prompt",
            invokable: true,
        });
    }
    else {
        return YAML.stringify(getContentsForNewBlock(blockType));
    }
}
async function findAvailableFilename(baseDirUri, blockType, fileExists, extension, isGlobal, baseFilenameOverride) {
    const fileExtension = extension ?? getFileExtension(blockType);
    let baseFilename = "";
    const trimmedOverride = baseFilenameOverride?.trim();
    if (trimmedOverride) {
        if (blockType === "rules") {
            const withoutExtension = trimmedOverride.replace(/\.[^./\\]+$/, "");
            const sanitized = (0, config_yaml_1.sanitizeRuleName)(withoutExtension);
            baseFilename = sanitized;
        }
        else {
            baseFilename = trimmedOverride;
        }
    }
    if (!baseFilename) {
        baseFilename =
            blockType === "rules" && isGlobal
                ? "global-rule"
                : `new-${BLOCK_TYPE_CONFIG[blockType]?.filename}`;
    }
    let counter = 0;
    let fileUri;
    do {
        const suffix = counter === 0 ? "" : `-${counter}`;
        fileUri = (0, uri_1.joinPathsToUri)(baseDirUri, `${baseFilename}${suffix}.${fileExtension}`);
        counter++;
    } while (await fileExists(fileUri));
    return fileUri;
}
async function createNewWorkspaceBlockFile(ide, blockType, baseFilename) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    if (workspaceDirs.length === 0) {
        throw new Error("No workspace directories found. Make sure you've opened a folder in your IDE.");
    }
    const baseDirUri = (0, uri_1.joinPathsToUri)(workspaceDirs[0], `.continue/${blockType}`);
    const fileUri = await findAvailableFilename(baseDirUri, blockType, ide.fileExists.bind(ide), undefined, false, baseFilename);
    const fileContent = getFileContent(blockType);
    await ide.writeFile(fileUri, fileContent);
    await ide.openFile(fileUri);
}
async function createNewGlobalRuleFile(ide, baseFilename) {
    try {
        const globalDir = (0, pathToUri_1.localPathToUri)((0, paths_1.getContinueGlobalPath)());
        // Create the rules subdirectory within the global directory
        const rulesDir = (0, uri_1.joinPathsToUri)(globalDir, "rules");
        const fileUri = await findAvailableFilename(rulesDir, "rules", ide.fileExists.bind(ide), undefined, true, // isGlobal = true for global rules
        baseFilename);
        const fileContent = getFileContent("rules");
        await ide.writeFile(fileUri, fileContent);
        await ide.openFile(fileUri);
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=workspaceBlocks.js.map