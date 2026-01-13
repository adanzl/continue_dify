"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const env_1 = require("../../control-plane/env");
class RulesContextProvider extends __1.BaseContextProvider {
    // This is only used within this class. Worst case if there are exact duplicates is that one always calls the other, but this is an extreme edge case
    // Can eventually pull in more metadata, but this is experimental
    getIdFromRule(rule) {
        return rule.slug ?? rule.sourceFile ?? rule.name ?? rule.rule;
    }
    getNameFromRule(rule) {
        return rule.name ?? rule.slug ?? rule.sourceFile ?? rule.source;
    }
    getDescriptionFromRule(rule) {
        return rule.description ?? rule.name ?? "";
    }
    getUriFromRule(rule, appUrl) {
        if (rule.sourceFile) {
            return {
                type: "file",
                value: rule.sourceFile,
            };
        }
        if (rule.slug) {
            let url = `${appUrl}${rule.slug}`;
            return {
                type: "url",
                value: url,
            };
        }
        return undefined;
    }
    async getContextItems(query, extras) {
        const rule = extras.config.rules.find((rule) => this.getIdFromRule(rule) === query);
        if (!rule) {
            return [];
        }
        const env = await (0, env_1.getControlPlaneEnv)(extras.ide.getIdeSettings());
        return [
            {
                name: this.getNameFromRule(rule),
                content: rule.rule,
                description: this.getDescriptionFromRule(rule),
                uri: this.getUriFromRule(rule, env.APP_URL),
            },
        ];
    }
    async loadSubmenuItems(args) {
        return args.config.rules.map((rule) => ({
            id: this.getIdFromRule(rule),
            description: this.getDescriptionFromRule(rule),
            title: this.getNameFromRule(rule),
        }));
    }
}
RulesContextProvider.description = {
    title: "rules",
    displayTitle: "Rules",
    description: "Mention rules files",
    type: "submenu",
    renderInlineAs: "",
};
exports.default = RulesContextProvider;
//# sourceMappingURL=RulesContextProvider.js.map