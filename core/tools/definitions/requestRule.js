"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRuleTool = void 0;
exports.getRequestRuleDescription = getRequestRuleDescription;
const builtIn_1 = require("../builtIn");
function getAvailableRules(rules) {
    // Must be explicitly false and no globs
    const agentRequestedRules = rules.filter((rule) => rule.alwaysApply === false && !rule.globs);
    if (agentRequestedRules.length === 0) {
        return "No rules available.";
    }
    return agentRequestedRules
        .map((rule) => `${rule.name}: ${rule.description}`)
        .join("\n");
}
function getRequestRuleDescription(rules) {
    const prefix = "Use this tool to retrieve additional 'rules' that contain more context/instructions based on their descriptions. Available rules:\n";
    return prefix + getAvailableRules(rules);
}
function getRequestRuleSystemMessageDescription(rules) {
    const prefix = `To retrieve "rules" that contain more context/instructions based on their descriptions, use the ${builtIn_1.BuiltInToolNames.RequestRule} tool with the name of the rule. The available rules are:\n`;
    const availableRules = getAvailableRules(rules);
    const suffix = "\n\nFor example, you might respond with:";
    return prefix + availableRules + suffix;
}
const requestRuleTool = ({ rules }) => ({
    type: "function",
    displayTitle: "Request Rules",
    wouldLikeTo: "request rule {{{ name }}}",
    isCurrently: "reading rule {{{ name }}}",
    hasAlready: "read rule {{{ name }}}",
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    readonly: false,
    function: {
        name: builtIn_1.BuiltInToolNames.RequestRule,
        description: getRequestRuleDescription(rules),
        parameters: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    description: "Name of the rule",
                },
            },
        },
    },
    systemMessageDescription: {
        prefix: getRequestRuleSystemMessageDescription(rules),
        exampleArgs: [["name", "rule_name"]],
    },
    defaultToolPolicy: "disabled",
});
exports.requestRuleTool = requestRuleTool;
//# sourceMappingURL=requestRule.js.map