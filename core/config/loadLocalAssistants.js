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
exports.isContinueConfigRelatedUri = isContinueConfigRelatedUri;
exports.isContinueAgentConfigFile = isContinueAgentConfigFile;
exports.isColocatedRulesFile = isColocatedRulesFile;
exports.getDotContinueSubDirs = getDotContinueSubDirs;
exports.getAllDotContinueDefinitionFiles = getAllDotContinueDefinitionFiles;
const config_yaml_1 = require("@continuedev/config-yaml");
const ignore_1 = __importDefault(require("ignore"));
const URI = __importStar(require("uri-js"));
const ignore_2 = require("../indexing/ignore");
const walkDir_1 = require("../indexing/walkDir");
const constants_1 = require("../llm/rules/constants");
const paths_1 = require("../util/paths");
const pathToUri_1 = require("../util/pathToUri");
const uri_1 = require("../util/uri");
const getWorkspaceContinueRuleDotFiles_1 = require("./getWorkspaceContinueRuleDotFiles");
const markdown_1 = require("./markdown");
function isContinueConfigRelatedUri(uri) {
    return (uri.endsWith(".continuerc.json") ||
        uri.endsWith(".prompt") ||
        !!markdown_1.SUPPORTED_AGENT_FILES.find((file) => uri.endsWith(`/${file}`)) ||
        uri.endsWith(getWorkspaceContinueRuleDotFiles_1.SYSTEM_PROMPT_DOT_FILE) ||
        (uri.includes(".continue") &&
            (uri.endsWith(".yaml") ||
                uri.endsWith(".yml") ||
                uri.endsWith(".json"))) ||
        [...config_yaml_1.BLOCK_TYPES, "agents", "assistants"].some((blockType) => uri.includes(`.continue/${blockType}`)));
}
function isContinueAgentConfigFile(uri) {
    const isYaml = uri.endsWith(".yaml") || uri.endsWith(".yml");
    if (!isYaml) {
        return false;
    }
    const normalizedUri = URI.normalize(uri);
    return (normalizedUri.includes(`/.continue/agents/`) ||
        normalizedUri.includes(`/.continue/assistants/`));
}
function isColocatedRulesFile(uri) {
    return (0, uri_1.getUriPathBasename)(uri) === constants_1.RULES_MARKDOWN_FILENAME;
}
async function getDefinitionFilesInDir(ide, dir, fileExtType) {
    try {
        const exists = await ide.fileExists(dir);
        if (!exists) {
            return [];
        }
        const overrideDefaultIgnores = (0, ignore_1.default)()
            .add(ignore_2.DEFAULT_IGNORE_FILETYPES.filter((t) => t !== "config.yaml" && t !== "config.yml"))
            .add(ignore_2.DEFAULT_IGNORE_DIRS);
        const uris = await (0, walkDir_1.walkDir)(dir, ide, {
            overrideDefaultIgnores,
            source: "get assistant files",
        });
        let assistantFilePaths;
        if (fileExtType === "yaml") {
            assistantFilePaths = uris.filter((p) => p.endsWith(".yaml") || p.endsWith(".yml"));
        }
        else if (fileExtType === "markdown") {
            assistantFilePaths = uris.filter((p) => p.endsWith(".md"));
        }
        else {
            assistantFilePaths = uris.filter((p) => p.endsWith(".yaml") || p.endsWith(".yml") || p.endsWith(".md"));
        }
        const results = assistantFilePaths.map(async (uri) => {
            const content = await ide.readFile(uri); // make a try catch
            return { path: uri, content };
        });
        return Promise.all(results);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
function getDotContinueSubDirs(ide, options, workspaceDirs, subDirName) {
    let fullDirs = [];
    // Workspace .continue/<subDirName>
    if (options.includeWorkspace) {
        fullDirs = workspaceDirs.map((dir) => (0, uri_1.joinPathsToUri)(dir, ".continue", subDirName));
    }
    // ~/.continue/<subDirName>
    if (options.includeGlobal) {
        fullDirs.push((0, pathToUri_1.localPathToUri)((0, paths_1.getGlobalFolderWithName)(subDirName)));
    }
    return fullDirs;
}
/**
 * This method searches in both ~/.continue and workspace .continue
 * for all YAML/Markdown files in the specified subdirectory, for example .continue/assistants or .continue/prompts
 */
async function getAllDotContinueDefinitionFiles(ide, options, subDirName) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    // Get all directories to check for assistant files
    const fullDirs = getDotContinueSubDirs(ide, options, workspaceDirs, subDirName);
    // Get all definition files from the directories
    const definitionFiles = (await Promise.all(fullDirs.map((dir) => getDefinitionFilesInDir(ide, dir, options.fileExtType)))).flat();
    return definitionFiles;
}
//# sourceMappingURL=loadLocalAssistants.js.map