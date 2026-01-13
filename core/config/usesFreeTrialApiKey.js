"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usesCreditsBasedApiKey = usesCreditsBasedApiKey;
const config_yaml_1 = require("@continuedev/config-yaml");
/**
 * Helper function to determine if the config uses an API key that relies on Continue credits (free trial or models add-on)
 * @param config The serialized config object
 * @returns true if the config is using any free trial models
 */
function usesCreditsBasedApiKey(config) {
    if (!config) {
        return false;
    }
    // Check if the currently selected chat model uses free-trial provider
    const modelsByRole = config.modelsByRole;
    const allModels = [...Object.values(modelsByRole)].flat();
    // Check if any of the chat models use free-trial provider
    try {
        const hasFreeTrial = allModels?.some(modelUsesCreditsBasedApiKey);
        return hasFreeTrial;
    }
    catch (e) {
        console.error("Error checking for free trial API key:", e);
    }
    return false;
}
const modelUsesCreditsBasedApiKey = (model) => {
    if (!model.apiKeyLocation) {
        return false;
    }
    const secretType = (0, config_yaml_1.decodeSecretLocation)(model.apiKeyLocation).secretType;
    return secretType === config_yaml_1.SecretType.FreeTrial;
};
//# sourceMappingURL=usesFreeTrialApiKey.js.map