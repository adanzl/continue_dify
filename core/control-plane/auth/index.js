"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthUrlForTokenPage = getAuthUrlForTokenPage;
const uuid_1 = require("uuid");
const AuthTypes_1 = require("../AuthTypes");
const env_1 = require("../env");
async function getAuthUrlForTokenPage(ideSettingsPromise, useOnboarding) {
    const env = await (0, env_1.getControlPlaneEnv)(ideSettingsPromise);
    if (!(0, AuthTypes_1.isHubEnv)(env)) {
        throw new Error("Sign in disabled");
    }
    const url = new URL("https://api.workos.com/user_management/authorize");
    const params = {
        response_type: "code",
        client_id: env.WORKOS_CLIENT_ID,
        redirect_uri: `${env.APP_URL}tokens/${useOnboarding ? "onboarding-" : ""}callback`,
        // redirect_uri: "http://localhost:3000/tokens/callback",
        state: (0, uuid_1.v4)(),
        provider: "authkit",
    };
    Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));
    return url.toString();
}
//# sourceMappingURL=index.js.map