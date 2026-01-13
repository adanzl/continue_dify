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
exports.loadJsonMcpConfigs = loadJsonMcpConfigs;
const config_yaml_1 = require("@continuedev/config-yaml");
const JSONC = __importStar(require("comment-json"));
const ignore_1 = __importDefault(require("ignore"));
const yamlToContinueConfig_1 = require("../../../config/yaml/yamlToContinueConfig");
const ignore_2 = require("../../../indexing/ignore");
const walkDir_1 = require("../../../indexing/walkDir");
const util_1 = require("../../../util");
const paths_1 = require("../../../util/paths");
const pathToUri_1 = require("../../../util/pathToUri");
const uri_1 = require("../../../util/uri");
/**
 * Loads MCP configs from JSON files in ~/.continue/mcpServers and workspace .continue/mcpServers
 */
async function loadJsonMcpConfigs(ide, includeGlobal, globalRequestOptions = undefined) {
    const errors = [];
    // Get dirs
    const workspaceDirs = await ide.getWorkspaceDirs();
    const mcpDirs = workspaceDirs.map((dir) => (0, uri_1.joinPathsToUri)(dir, ".continue", "mcpServers"));
    if (includeGlobal) {
        mcpDirs.push((0, pathToUri_1.localPathToUri)((0, paths_1.getGlobalFolderWithName)("mcpServers")));
    }
    // Get json files and their contents
    const overrideDefaultIgnores = (0, ignore_1.default)()
        .add(ignore_2.DEFAULT_IGNORE_FILETYPES.filter((val) => !["config.json", "settings.json"].includes(val)))
        .add(ignore_2.DEFAULT_IGNORE_DIRS);
    const jsonFiles = [];
    await Promise.all(mcpDirs.map(async (dir) => {
        const exists = await ide.fileExists(dir);
        if (!exists) {
            return;
        }
        try {
            const uris = await (0, walkDir_1.walkDir)(dir, ide, {
                overrideDefaultIgnores,
                source: "get mcp json files",
            });
            const jsonUris = uris.filter((uri) => uri.endsWith(".json"));
            await Promise.all(jsonUris.map(async (uri) => {
                try {
                    const content = await ide.readFile(uri);
                    jsonFiles.push({ uri, content });
                }
                catch (e) {
                    errors.push({
                        fatal: false,
                        message: `Failed to read MCP server JSON file at ${uri}: ${e instanceof Error ? e.message : String(e)}`,
                    });
                }
            }));
        }
        catch (e) {
            errors.push({
                fatal: false,
                message: `Failed to check for MCP JSON files in ${dir}: ${e instanceof Error ? e.message : String(e)}`,
            });
        }
    }));
    const validJsonConfigs = [];
    for (const { content, uri } of jsonFiles) {
        try {
            const json = JSONC.parse(content);
            // Try parsing as a file with mcpServers and multiple servers (claude code/desktop-esque format)
            const claudeCodeFileParsed = config_yaml_1.claudeCodeLikeConfigFileSchema.safeParse(json);
            if (claudeCodeFileParsed.success) {
                if (claudeCodeFileParsed.data.mcpServers) {
                    validJsonConfigs.push(...Object.entries(claudeCodeFileParsed.data.mcpServers).map(([name, mcpJson]) => ({
                        name,
                        mcpJson,
                        uri,
                    })));
                }
                const projectServers = Object.values(claudeCodeFileParsed.data.projects).map((v) => v.mcpServers);
                for (const mcpServers of projectServers) {
                    if (mcpServers) {
                        validJsonConfigs.push(...Object.entries(mcpServers).map(([name, mcpJson]) => ({
                            name,
                            mcpJson,
                            uri,
                        })));
                    }
                }
            }
            else {
                const claudeDesktopFileParsed = config_yaml_1.claudeDesktopLikeConfigFileSchema.safeParse(json);
                if (claudeDesktopFileParsed.success) {
                    validJsonConfigs.push(...Object.entries(claudeDesktopFileParsed.data.mcpServers).map(([name, mcpJson]) => ({
                        name,
                        mcpJson,
                        uri,
                    })));
                }
                else {
                    // Try parsing as single JSON file
                    const singleConfigParsed = config_yaml_1.mcpServersJsonSchema.safeParse(json);
                    if (singleConfigParsed.success) {
                        validJsonConfigs.push({
                            mcpJson: singleConfigParsed.data,
                            name: (0, uri_1.getUriPathBasename)(uri).replace(".json", ""),
                            uri,
                        });
                    }
                    else {
                        errors.push({
                            fatal: false,
                            message: `MCP JSON file at ${uri} doesn't match a supported MCP JSON configuration format`,
                        });
                    }
                }
            }
        }
        catch (e) {
            errors.push({
                fatal: false,
                message: `Error parsing MCP JSON file at ${uri}: ${e instanceof Error ? e.message : String(e)}`,
            });
        }
    }
    // De-duplicate
    const deduplicatedJsonConfigs = (0, util_1.deduplicateArray)(validJsonConfigs, (a, b) => a.name === b.name);
    // Two levels of conversion for now.
    const yamlConfigs = deduplicatedJsonConfigs.map((c) => {
        const { warnings, yamlConfig } = (0, config_yaml_1.convertJsonMcpConfigToYamlMcpConfig)(c.name, c.mcpJson);
        return {
            warnings,
            yamlConfig: {
                ...yamlConfig,
                sourceFile: c.uri,
            },
        };
    });
    const mcpServers = yamlConfigs.map((c) => {
        errors.push(...c.warnings.map((warning) => ({
            fatal: false,
            message: warning,
            uri: c.yamlConfig.sourceFile,
        })));
        return (0, yamlToContinueConfig_1.convertYamlMcpConfigToInternalMcpOptions)(c.yamlConfig, globalRequestOptions);
    });
    // Parse and convert files
    return {
        mcpServers,
        errors,
    };
}
//# sourceMappingURL=loadJsonMcpConfigs.js.map