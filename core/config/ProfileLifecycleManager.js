"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileLifecycleManager = void 0;
const Logger_js_1 = require("../util/Logger.js");
const load_js_1 = require("./load.js");
class ProfileLifecycleManager {
    constructor(profileLoader, ide) {
        this.profileLoader = profileLoader;
        this.ide = ide;
    }
    get profileDescription() {
        return this.profileLoader.description;
    }
    clearConfig() {
        this.savedConfigResult = undefined;
        this.savedBrowserConfigResult = undefined;
        this.pendingConfigPromise = undefined;
    }
    // Clear saved config and reload
    async reloadConfig(additionalContextProviders = []) {
        this.savedConfigResult = undefined;
        this.savedBrowserConfigResult = undefined;
        this.pendingConfigPromise = undefined;
        return this.loadConfig(additionalContextProviders, true);
    }
    async loadConfig(additionalContextProviders, forceReload = false) {
        // If we already have a config, return it
        if (!forceReload) {
            if (this.savedConfigResult) {
                return this.savedConfigResult;
            }
            else if (this.pendingConfigPromise) {
                return this.pendingConfigPromise;
            }
        }
        // Set pending config promise
        this.pendingConfigPromise = new Promise((resolve) => {
            void (async () => {
                let result;
                // This try catch is expected to catch high-level errors that aren't block-specific
                // Like invalid json, invalid yaml, file read errors, etc.
                // NOT block-specific loading errors
                try {
                    result = await this.profileLoader.doLoadConfig();
                }
                catch (e) {
                    // Capture config loading system failures to Sentry
                    Logger_js_1.Logger.error(e, {
                        context: "profile_config_loading",
                    });
                    const message = e instanceof Error
                        ? `${e.message}\n${e.stack ? e.stack : ""}`
                        : "Error loading config";
                    result = {
                        errors: [
                            {
                                fatal: true,
                                message,
                            },
                        ],
                        config: undefined,
                        configLoadInterrupted: true,
                    };
                }
                if (result.config) {
                    // Add registered context providers
                    result.config.contextProviders = (result.config.contextProviders ?? []).concat(additionalContextProviders);
                }
                resolve(result);
            })();
        });
        // Wait for the config promise to resolve
        this.savedConfigResult = await this.pendingConfigPromise;
        this.pendingConfigPromise = undefined;
        return this.savedConfigResult;
    }
    async getSerializedConfig(additionalContextProviders) {
        if (this.savedBrowserConfigResult) {
            return this.savedBrowserConfigResult;
        }
        else {
            const result = await this.loadConfig(additionalContextProviders);
            if (!result.config) {
                return {
                    ...result,
                    config: undefined,
                };
            }
            const serializedConfig = await (0, load_js_1.finalToBrowserConfig)(result.config, this.ide);
            return {
                ...result,
                config: serializedConfig,
            };
        }
    }
}
exports.ProfileLifecycleManager = ProfileLifecycleManager;
//# sourceMappingURL=ProfileLifecycleManager.js.map