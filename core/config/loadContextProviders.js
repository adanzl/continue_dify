"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigContextProviders = loadConfigContextProviders;
const providers_1 = require("../context/providers");
const CurrentFileContextProvider_1 = __importDefault(require("../context/providers/CurrentFileContextProvider"));
const DiffContextProvider_1 = __importDefault(require("../context/providers/DiffContextProvider"));
const DocsContextProvider_1 = __importDefault(require("../context/providers/DocsContextProvider"));
const FileContextProvider_1 = __importDefault(require("../context/providers/FileContextProvider"));
const ProblemsContextProvider_1 = __importDefault(require("../context/providers/ProblemsContextProvider"));
const RulesContextProvider_1 = __importDefault(require("../context/providers/RulesContextProvider"));
const TerminalContextProvider_1 = __importDefault(require("../context/providers/TerminalContextProvider"));
/*
    Loads context providers based on configuration
    - default providers will always be loaded, using config params if present
    - other providers will be loaded if configured

    NOTE the MCPContextProvider is added in doLoadConfig if any resources are present
*/
function loadConfigContextProviders(configContext, hasDocs, ideType) {
    const providers = [];
    const errors = [];
    const defaultProviders = [
        new FileContextProvider_1.default({}),
        new CurrentFileContextProvider_1.default({}),
        new DiffContextProvider_1.default({}),
        new TerminalContextProvider_1.default({}),
        new ProblemsContextProvider_1.default({}),
        new RulesContextProvider_1.default({}),
    ];
    // Add from config
    if (configContext) {
        for (const config of configContext) {
            const cls = (0, providers_1.contextProviderClassFromName)(config.provider);
            if (!cls &&
                !defaultProviders.find((p) => p.description.title === config.provider)) {
                errors.push({
                    fatal: false,
                    message: `Unknown context provider ${config.provider}`,
                });
                continue;
            }
            providers.push(new cls({
                name: config.name,
                ...config.params,
            }));
        }
    }
    // Add from defaults if not found in config
    for (const defaultProvider of defaultProviders) {
        if (!providers.find((p) => p.description.title === defaultProvider.description.title)) {
            providers.push(defaultProvider);
        }
    }
    if (hasDocs && !providers?.some((cp) => cp.description.title === "docs")) {
        providers.push(new DocsContextProvider_1.default({}));
    }
    // @problems and @terminal are not supported in jetbrains
    const filteredProviders = providers.filter((pv) => {
        if (ideType === "jetbrains") {
            return (pv.description.title !== TerminalContextProvider_1.default.description.title &&
                pv.description.title !== ProblemsContextProvider_1.default.description.title);
        }
        return true;
    });
    return {
        providers: filteredProviders,
        errors,
    };
}
//# sourceMappingURL=loadContextProviders.js.map