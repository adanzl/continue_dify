"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rectifySelectedModelsFromGlobalContext = rectifySelectedModelsFromGlobalContext;
const constants_1 = require("../llm/constants");
const GlobalContext_1 = require("../util/GlobalContext");
function rectifySelectedModelsFromGlobalContext(continueConfig, profileId) {
    const configCopy = { ...continueConfig };
    const globalContext = new GlobalContext_1.GlobalContext();
    const currentSelectedModels = globalContext.get("selectedModelsByProfileId");
    const currentForProfile = currentSelectedModels?.[profileId] ?? {};
    let fellBack = false;
    // summarize not implemented yet
    const roles = [
        "autocomplete",
        "apply",
        "edit",
        "embed",
        "rerank",
        "chat",
    ];
    for (const role of roles) {
        let newModel = null;
        const currentSelection = currentForProfile[role] ?? null;
        if (currentSelection) {
            const match = continueConfig.modelsByRole[role].find((m) => m.title === currentSelection);
            if (match) {
                newModel = match;
            }
        }
        if (!newModel && continueConfig.modelsByRole[role].length > 0) {
            newModel = continueConfig.modelsByRole[role][0];
        }
        if (!(currentSelection === (newModel?.title ?? null))) {
            fellBack = true;
        }
        // Currently only check for configuration status for apply
        if (role === "apply" &&
            newModel?.getConfigurationStatus() !== constants_1.LLMConfigurationStatuses.VALID) {
            continue;
        }
        configCopy.selectedModelByRole[role] = newModel;
    }
    // In the case shared config wasn't respected,
    // Rewrite the shared config
    if (fellBack) {
        globalContext.update("selectedModelsByProfileId", {
            ...currentSelectedModels,
            [profileId]: Object.fromEntries(Object.entries(configCopy.selectedModelByRole).map(([key, value]) => [
                key,
                value?.title ?? null,
            ])),
        });
    }
    return configCopy;
}
//# sourceMappingURL=selectedModels.js.map