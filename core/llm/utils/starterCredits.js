"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOutOfStarterCredits = isOutOfStarterCredits;
function isOutOfStarterCredits(usingModelsAddOnApiKey, creditStatus) {
    return (usingModelsAddOnApiKey &&
        !creditStatus.hasCredits &&
        !creditStatus.hasPurchasedCredits);
}
//# sourceMappingURL=starterCredits.js.map