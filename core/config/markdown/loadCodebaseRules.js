"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodebaseRulesCache = void 0;
exports.loadCodebaseRules = loadCodebaseRules;
const config_yaml_1 = require("@continuedev/config-yaml");
const walkDir_1 = require("../../indexing/walkDir");
const constants_1 = require("../../llm/rules/constants");
const uri_1 = require("../../util/uri");
class CodebaseRulesCache {
    constructor() {
        this.rules = [];
        this.errors = [];
    }
    static getInstance() {
        if (CodebaseRulesCache.instance === null) {
            CodebaseRulesCache.instance = new CodebaseRulesCache();
        }
        return CodebaseRulesCache.instance;
    }
    async refresh(ide) {
        const { rules, errors } = await loadCodebaseRules(ide);
        this.rules = rules;
        this.errors = errors;
    }
    async update(ide, uri) {
        const content = await ide.readFile(uri);
        const workspaceDirs = await ide.getWorkspaceDirs();
        const { relativePathOrBasename, foundInDir } = (0, uri_1.findUriInDirs)(uri, workspaceDirs);
        if (!foundInDir) {
            console.warn(`Failed to load codebase rule ${uri}: URI not found in workspace`);
        }
        const rule = (0, config_yaml_1.markdownToRule)(content, {
            uriType: "file",
            fileUri: uri,
        }, relativePathOrBasename);
        const ruleWithSource = {
            ...rule,
            source: "colocated-markdown",
            sourceFile: uri,
        };
        const matchIdx = this.rules.findIndex((r) => r.sourceFile === uri);
        if (matchIdx === -1) {
            this.rules.push(ruleWithSource);
        }
        else {
            this.rules[matchIdx] = ruleWithSource;
        }
    }
    remove(uri) {
        this.rules = this.rules.filter((r) => r.sourceFile !== uri);
    }
}
exports.CodebaseRulesCache = CodebaseRulesCache;
CodebaseRulesCache.instance = null;
/**
 * Loads rules from rules.md files colocated in the codebase
 */
async function loadCodebaseRules(ide) {
    const errors = [];
    const rules = [];
    try {
        // Get all files from the workspace
        const allFiles = await (0, walkDir_1.walkDirs)(ide);
        // Filter to just rules.md files
        const rulesMdFiles = allFiles.filter((file) => {
            const filename = (0, uri_1.getUriPathBasename)(file);
            return filename === constants_1.RULES_MARKDOWN_FILENAME;
        });
        // Process each rules.md file
        for (const filePath of rulesMdFiles) {
            try {
                const content = await ide.readFile(filePath);
                const { relativePathOrBasename, foundInDir, uri } = (0, uri_1.findUriInDirs)(filePath, await ide.getWorkspaceDirs());
                if (foundInDir) {
                    const lastSlashIndex = relativePathOrBasename.lastIndexOf("/");
                    const parentDir = relativePathOrBasename.substring(0, lastSlashIndex);
                    const rule = (0, config_yaml_1.markdownToRule)(content, {
                        uriType: "file",
                        fileUri: uri,
                    }, parentDir);
                    rules.push({
                        ...rule,
                        source: "colocated-markdown",
                        sourceFile: filePath,
                    });
                }
                else {
                    console.warn(`Failed to load codebase rule ${uri}: URI not found in workspace dirs`);
                }
            }
            catch (e) {
                errors.push({
                    fatal: false,
                    message: `Failed to parse colocated rule file ${filePath}: ${e instanceof Error ? e.message : e}`,
                });
            }
        }
    }
    catch (e) {
        errors.push({
            fatal: false,
            message: `Error loading colocated rule files: ${e instanceof Error ? e.message : e}`,
        });
    }
    return { rules, errors };
}
//# sourceMappingURL=loadCodebaseRules.js.map