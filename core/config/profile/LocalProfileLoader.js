"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_yaml_1 = require("@continuedev/config-yaml");
const paths_js_1 = require("../../util/paths.js");
const pathToUri_js_1 = require("../../util/pathToUri.js");
const uri_js_1 = require("../../util/uri.js");
const doLoadConfig_js_1 = __importDefault(require("./doLoadConfig.js"));
class LocalProfileLoader {
    constructor(ide, controlPlaneClient, llmLogger, overrideAssistantFile) {
        this.ide = ide;
        this.controlPlaneClient = controlPlaneClient;
        this.llmLogger = llmLogger;
        this.overrideAssistantFile = overrideAssistantFile;
        const description = {
            id: overrideAssistantFile?.path ?? LocalProfileLoader.ID,
            profileType: "local",
            fullSlug: {
                ownerSlug: "",
                packageSlug: "",
                versionSlug: "",
            },
            iconUrl: "",
            title: overrideAssistantFile?.path
                ? (0, uri_js_1.getUriPathBasename)(overrideAssistantFile.path)
                : "Local Config",
            errors: undefined,
            uri: overrideAssistantFile?.path ??
                (0, pathToUri_js_1.localPathToUri)((0, paths_js_1.getPrimaryConfigFilePath)()),
            rawYaml: undefined,
        };
        this.description = description;
        if (overrideAssistantFile?.content) {
            try {
                const parsedAssistant = (0, config_yaml_1.parseConfigYaml)(overrideAssistantFile?.content ?? "");
                this.description.title = parsedAssistant.name;
            }
            catch (e) {
                console.error("Failed to parse config file: ", e);
            }
        }
    }
    async doLoadConfig() {
        const result = await (0, doLoadConfig_js_1.default)({
            ide: this.ide,
            controlPlaneClient: this.controlPlaneClient,
            llmLogger: this.llmLogger,
            profileId: this.description.id,
            overrideConfigYamlByPath: this.overrideAssistantFile?.path,
            orgScopeId: null,
            packageIdentifier: {
                uriType: "file",
                fileUri: this.overrideAssistantFile?.path ?? (0, paths_js_1.getPrimaryConfigFilePath)(),
            },
        });
        this.description.errors = result.errors;
        return result;
    }
    setIsActive(isActive) { }
}
LocalProfileLoader.ID = "local";
exports.default = LocalProfileLoader;
//# sourceMappingURL=LocalProfileLoader.js.map