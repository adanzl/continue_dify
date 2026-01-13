"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRuleImpl = void 0;
const errors_1 = require("../../util/errors");
const parseArgs_1 = require("../parseArgs");
const requestRuleImpl = async (args, extras) => {
    const name = (0, parseArgs_1.getStringArg)(args, "name");
    // Find the rule by name in the config
    const rule = extras.config.rules.find((r) => r.name === name);
    if (!rule || !rule.sourceFile) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.RuleNotFound, `Rule with name "${name}" not found or has no file path`);
    }
    return [
        {
            name: rule.name ?? "",
            description: rule.description ?? "",
            content: rule.rule,
            uri: {
                type: "file",
                value: rule.sourceFile,
            },
        },
    ];
};
exports.requestRuleImpl = requestRuleImpl;
//# sourceMappingURL=requestRule.js.map