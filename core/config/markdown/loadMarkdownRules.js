"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_AGENT_FILES = void 0;
exports.loadMarkdownRules = loadMarkdownRules;
const config_yaml_1 = require("@continuedev/config-yaml");
const promptFiles_1 = require("../../promptFiles");
const uri_1 = require("../../util/uri");
const loadLocalAssistants_1 = require("../loadLocalAssistants");
exports.SUPPORTED_AGENT_FILES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"];
/**
 * Loads rules from markdown files in the .continue/rules and .continue/prompts directories
 * and agent files (AGENTS.md, AGENT.md, CLAUDE.md) at workspace root
 */
async function loadMarkdownRules(ide) {
    const errors = [];
    const rules = [];
    // First, try to load agent files from workspace root
    const workspaceDirs = await ide.getWorkspaceDirs();
    for (const workspaceDir of workspaceDirs) {
        let agentFileFound = false;
        for (const fileName of exports.SUPPORTED_AGENT_FILES) {
            try {
                const agentFileUri = (0, uri_1.joinPathsToUri)(workspaceDir, fileName);
                const exists = await ide.fileExists(agentFileUri);
                if (exists) {
                    const agentContent = await ide.readFile(agentFileUri);
                    const rule = (0, config_yaml_1.markdownToRule)(agentContent, {
                        uriType: "file",
                        fileUri: agentFileUri,
                    });
                    rules.push({
                        ...rule,
                        source: "agentFile",
                        sourceFile: agentFileUri,
                        alwaysApply: true,
                    });
                    agentFileFound = true;
                }
                break; // Use the first found agent file in this workspace
            }
            catch (e) {
                // File doesn't exist or can't be read, continue to next file
            }
        }
        if (agentFileFound) {
            break; // Use agent file from first workspace that has one
        }
    }
    // Load markdown files from both .continue/rules and .continue/prompts
    const dirsToCheck = [promptFiles_1.RULES_DIR_NAME, promptFiles_1.PROMPTS_DIR_NAME];
    for (const dirName of dirsToCheck) {
        try {
            const markdownFiles = await (0, loadLocalAssistants_1.getAllDotContinueDefinitionFiles)(ide, {
                includeGlobal: true,
                includeWorkspace: true,
                fileExtType: "markdown",
            }, dirName);
            // Filter to just .md files
            const mdFiles = markdownFiles.filter((file) => file.path.endsWith(".md"));
            // Process each markdown file
            for (const file of mdFiles) {
                try {
                    const rule = (0, config_yaml_1.markdownToRule)(file.content, {
                        uriType: "file",
                        fileUri: file.path,
                    });
                    if (!rule.invokable) {
                        rules.push({
                            ...rule,
                            source: "rules-block",
                            sourceFile: file.path,
                        });
                    }
                }
                catch (e) {
                    errors.push({
                        fatal: false,
                        message: `Failed to parse markdown rule file ${file.path}: ${e instanceof Error ? e.message : e}`,
                    });
                }
            }
        }
        catch (e) {
            errors.push({
                fatal: false,
                message: `Error loading markdown rule files from ${dirName}: ${e instanceof Error ? e.message : e}`,
            });
        }
    }
    return { rules, errors };
}
//# sourceMappingURL=loadMarkdownRules.js.map