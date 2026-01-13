"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertYamlRuleToContinueRule = convertYamlRuleToContinueRule;
exports.convertYamlMcpConfigToInternalMcpOptions = convertYamlMcpConfigToInternalMcpOptions;
const config_yaml_1 = require("@continuedev/config-yaml");
function convertYamlRuleToContinueRule(rule) {
    if (typeof rule === "string") {
        return {
            rule: rule,
            source: "rules-block",
        };
    }
    else {
        return {
            source: "rules-block",
            rule: rule.rule,
            globs: rule.globs,
            name: rule.name,
            description: rule.description,
            sourceFile: rule.sourceFile,
            alwaysApply: rule.alwaysApply,
            invokable: rule.invokable ?? false,
        };
    }
}
function convertYamlMcpConfigToInternalMcpOptions(config, globalRequestOptions) {
    const { connectionTimeout, faviconUrl, name, sourceFile } = config;
    const shared = {
        id: name,
        name,
        faviconUrl: faviconUrl,
        timeout: connectionTimeout,
        sourceFile,
    };
    // Stdio
    if ("command" in config) {
        const { args, command, cwd, env, type } = config;
        const stdioOptions = {
            ...shared,
            type,
            command,
            args,
            cwd,
            env,
        };
        return stdioOptions;
    }
    // HTTP/SSE
    const { type, url, apiKey, requestOptions } = config;
    const httpSseConfig = {
        ...shared,
        type,
        url,
        apiKey,
        requestOptions: (0, config_yaml_1.mergeConfigYamlRequestOptions)(requestOptions, globalRequestOptions),
    };
    return httpSseConfig;
}
//# sourceMappingURL=yamlToContinueConfig.js.map