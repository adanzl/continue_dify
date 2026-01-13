"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuleBlockImpl = void 0;
const config_yaml_1 = require("@continuedev/config-yaml");
const utils_1 = require("../../config/markdown/utils");
const parseArgs_1 = require("../parseArgs");
const createRuleBlockImpl = async (args, extras) => {
    const name = (0, parseArgs_1.getStringArg)(args, "name");
    const rule = (0, parseArgs_1.getStringArg)(args, "rule");
    const description = (0, parseArgs_1.getOptionalStringArg)(args, "description");
    const regex = (0, parseArgs_1.getOptionalStringArg)(args, "regex");
    const globs = (0, parseArgs_1.getOptionalStringArg)(args, "globs");
    const alwaysApply = (0, parseArgs_1.getBooleanArg)(args, "alwaysApply", false);
    const fileContent = (0, config_yaml_1.createRuleMarkdown)(name, rule, {
        alwaysApply,
        description,
        globs,
        regex,
    });
    const [localContinueDir] = await extras.ide.getWorkspaceDirs();
    const ruleFilePath = (0, utils_1.createRuleFilePath)(localContinueDir, name);
    await extras.ide.writeFile(ruleFilePath, fileContent);
    await extras.ide.openFile(ruleFilePath);
    return [
        {
            name: "New Rule Block",
            description: description || "",
            uri: {
                type: "file",
                value: ruleFilePath,
            },
            content: `Rule created successfully`,
        },
    ];
};
exports.createRuleBlockImpl = createRuleBlockImpl;
//# sourceMappingURL=createRuleBlock.js.map