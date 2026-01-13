"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRelativeRuleFilePath = createRelativeRuleFilePath;
exports.createRuleFilePath = createRuleFilePath;
const config_yaml_1 = require("@continuedev/config-yaml");
const uri_1 = require("../../util/uri");
function createRelativeRuleFilePathParts(ruleName) {
    const safeRuleName = (0, config_yaml_1.sanitizeRuleName)(ruleName);
    return [".continue", "rules", `${safeRuleName}.${config_yaml_1.RULE_FILE_EXTENSION}`];
}
function createRelativeRuleFilePath(ruleName) {
    return createRelativeRuleFilePathParts(ruleName).join("/");
}
/**
 * Creates the file path for a rule in the workspace .continue/rules directory
 */
function createRuleFilePath(workspaceDir, ruleName) {
    return (0, uri_1.joinPathsToUri)(workspaceDir, ...createRelativeRuleFilePathParts(ruleName));
}
//# sourceMappingURL=utils.js.map