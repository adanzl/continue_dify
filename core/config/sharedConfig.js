"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedConfigSchema = void 0;
exports.salvageSharedConfig = salvageSharedConfig;
exports.modifyAnyConfigWithSharedConfig = modifyAnyConfigWithSharedConfig;
const zod_1 = __importDefault(require("zod"));
exports.sharedConfigSchema = zod_1.default
    .object({
    // boolean fields in config.json
    allowAnonymousTelemetry: zod_1.default.boolean(),
    disableIndexing: zod_1.default.boolean(),
    disableSessionTitles: zod_1.default.boolean(),
    // `experimental` in `ContinueConfig`
    useChromiumForDocsCrawling: zod_1.default.boolean(),
    readResponseTTS: zod_1.default.boolean(),
    promptPath: zod_1.default.string(),
    useCurrentFileAsContext: zod_1.default.boolean(),
    enableExperimentalTools: zod_1.default.boolean(),
    onlyUseSystemMessageTools: zod_1.default.boolean(),
    codebaseToolCallingOnly: zod_1.default.boolean(),
    enableStaticContextualization: zod_1.default.boolean(),
    // `ui` in `ContinueConfig`
    showSessionTabs: zod_1.default.boolean(),
    codeBlockToolbarPosition: zod_1.default.enum(["top", "bottom"]),
    fontSize: zod_1.default.number(),
    codeWrap: zod_1.default.boolean(),
    displayRawMarkdown: zod_1.default.boolean(),
    showChatScrollbar: zod_1.default.boolean(),
    continueAfterToolRejection: zod_1.default.boolean(),
    // `tabAutocompleteOptions` in `ContinueConfig`
    useAutocompleteCache: zod_1.default.boolean(),
    useAutocompleteMultilineCompletions: zod_1.default.enum(["always", "never", "auto"]),
    disableAutocompleteInFiles: zod_1.default.array(zod_1.default.string()),
    modelTimeout: zod_1.default.number(),
    debounceDelay: zod_1.default.number(),
})
    .partial();
// For security in case of damaged config file, try to salvage any security-related values
function salvageSharedConfig(sharedConfig) {
    const salvagedConfig = {};
    if ("allowAnonymousTelemetry" in sharedConfig) {
        const val = zod_1.default.boolean().safeParse(sharedConfig.allowAnonymousTelemetry);
        if (val.success) {
            salvagedConfig.allowAnonymousTelemetry = val.data;
        }
    }
    if ("disableIndexing" in sharedConfig) {
        const val = zod_1.default.boolean().safeParse(sharedConfig.disableIndexing);
        if (val.success) {
            salvagedConfig.disableIndexing = val.data;
        }
    }
    if ("disableSessionTitles" in sharedConfig) {
        const val = zod_1.default.boolean().safeParse(sharedConfig.disableSessionTitles);
        if (val.success) {
            salvagedConfig.disableSessionTitles = val.data;
        }
    }
    if ("disableAutocompleteInFiles" in sharedConfig) {
        const val = exports.sharedConfigSchema.shape.disableAutocompleteInFiles.safeParse(sharedConfig.disableAutocompleteInFiles);
        if (val.success) {
            salvagedConfig.disableAutocompleteInFiles = val.data;
        }
    }
    return salvagedConfig;
}
// Apply shared config to all forms of config
// - SerializedContinueConfig (config.json)
// - Config ("intermediate") - passed to config.ts
// - ContinueConfig
// - BrowserSerializedContinueConfig (final converted to be passed to GUI)
// This modify function is split into two steps
// - rectifySharedModelsFromSharedConfig - includes boolean flags like allowAnonymousTelemetry which
//   must be added BEFORE config.ts and remote server config apply for JSON
//   for security reasons
// - setSharedModelsFromSharedConfig - exists because of selectedModelsByRole
//   Which don't exist on SerializedContinueConfig/Config types, so must be added after the fact
function modifyAnyConfigWithSharedConfig(continueConfig, sharedConfig) {
    const configCopy = { ...continueConfig };
    configCopy.tabAutocompleteOptions = {
        ...configCopy.tabAutocompleteOptions,
    };
    if (sharedConfig.useAutocompleteCache !== undefined) {
        configCopy.tabAutocompleteOptions.useCache =
            sharedConfig.useAutocompleteCache;
    }
    if (sharedConfig.useAutocompleteMultilineCompletions !== undefined) {
        configCopy.tabAutocompleteOptions.multilineCompletions =
            sharedConfig.useAutocompleteMultilineCompletions;
    }
    if (sharedConfig.disableAutocompleteInFiles !== undefined) {
        configCopy.tabAutocompleteOptions.disableInFiles =
            sharedConfig.disableAutocompleteInFiles;
    }
    if (sharedConfig.modelTimeout !== undefined) {
        configCopy.tabAutocompleteOptions.modelTimeout = sharedConfig.modelTimeout;
    }
    if (sharedConfig.debounceDelay !== undefined) {
        configCopy.tabAutocompleteOptions.debounceDelay =
            sharedConfig.debounceDelay;
    }
    configCopy.ui = {
        ...configCopy.ui,
    };
    if (sharedConfig.codeBlockToolbarPosition !== undefined) {
        configCopy.ui.codeBlockToolbarPosition =
            sharedConfig.codeBlockToolbarPosition;
    }
    if (sharedConfig.fontSize !== undefined) {
        configCopy.ui.fontSize = sharedConfig.fontSize;
    }
    if (sharedConfig.codeWrap !== undefined) {
        configCopy.ui.codeWrap = sharedConfig.codeWrap;
    }
    if (sharedConfig.displayRawMarkdown !== undefined) {
        configCopy.ui.displayRawMarkdown = sharedConfig.displayRawMarkdown;
    }
    if (sharedConfig.showChatScrollbar !== undefined) {
        configCopy.ui.showChatScrollbar = sharedConfig.showChatScrollbar;
    }
    if (sharedConfig.allowAnonymousTelemetry !== undefined) {
        configCopy.allowAnonymousTelemetry = sharedConfig.allowAnonymousTelemetry;
    }
    if (sharedConfig.disableIndexing !== undefined) {
        configCopy.disableIndexing = sharedConfig.disableIndexing;
    }
    if (sharedConfig.disableSessionTitles !== undefined) {
        configCopy.disableSessionTitles = sharedConfig.disableSessionTitles;
    }
    if (sharedConfig.showSessionTabs !== undefined) {
        configCopy.ui.showSessionTabs = sharedConfig.showSessionTabs;
    }
    if (sharedConfig.continueAfterToolRejection !== undefined) {
        configCopy.ui.continueAfterToolRejection =
            sharedConfig.continueAfterToolRejection;
    }
    configCopy.experimental = {
        ...configCopy.experimental,
    };
    if (sharedConfig.enableExperimentalTools !== undefined) {
        configCopy.experimental.enableExperimentalTools =
            sharedConfig.enableExperimentalTools;
    }
    if (sharedConfig.promptPath !== undefined) {
        configCopy.experimental.promptPath = sharedConfig.promptPath;
    }
    if (sharedConfig.useChromiumForDocsCrawling !== undefined) {
        configCopy.experimental.useChromiumForDocsCrawling =
            sharedConfig.useChromiumForDocsCrawling;
    }
    if (sharedConfig.readResponseTTS !== undefined) {
        configCopy.experimental.readResponseTTS = sharedConfig.readResponseTTS;
    }
    if (sharedConfig.useCurrentFileAsContext !== undefined) {
        configCopy.experimental.useCurrentFileAsContext =
            sharedConfig.useCurrentFileAsContext;
    }
    if (sharedConfig.onlyUseSystemMessageTools !== undefined) {
        configCopy.experimental.onlyUseSystemMessageTools =
            sharedConfig.onlyUseSystemMessageTools;
    }
    if (sharedConfig.codebaseToolCallingOnly !== undefined) {
        configCopy.experimental.codebaseToolCallingOnly =
            sharedConfig.codebaseToolCallingOnly;
    }
    if (sharedConfig.enableStaticContextualization !== undefined) {
        configCopy.experimental.enableStaticContextualization =
            sharedConfig.enableStaticContextualization;
    }
    return configCopy;
}
//# sourceMappingURL=sharedConfig.js.map