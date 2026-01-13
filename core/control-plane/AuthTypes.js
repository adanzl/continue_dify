"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthType = void 0;
exports.isOnPremSession = isOnPremSession;
exports.isHubEnv = isHubEnv;
function isOnPremSession(sessionInfo) {
    return sessionInfo !== undefined && sessionInfo.AUTH_TYPE === AuthType.OnPrem;
}
var AuthType;
(function (AuthType) {
    AuthType["WorkOsProd"] = "continue";
    AuthType["WorkOsStaging"] = "continue-staging";
    AuthType["OnPrem"] = "on-prem";
})(AuthType || (exports.AuthType = AuthType = {}));
function isHubEnv(env) {
    return ("AUTH_TYPE" in env &&
        env.AUTH_TYPE !== "on-prem" &&
        "WORKOS_CLIENT_ID" in env);
}
//# sourceMappingURL=AuthTypes.js.map