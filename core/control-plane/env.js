"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTENSION_NAME = void 0;
exports.enableHubContinueDev = enableHubContinueDev;
exports.getControlPlaneEnv = getControlPlaneEnv;
exports.getControlPlaneEnvSync = getControlPlaneEnvSync;
exports.useHub = useHub;
const fs = __importStar(require("node:fs"));
const paths_1 = require("../util/paths");
const AuthTypes_1 = require("./AuthTypes");
const mdm_1 = require("./mdm/mdm");
exports.EXTENSION_NAME = "continue";
const WORKOS_CLIENT_ID_PRODUCTION = "client_01J0FW6XN8N2XJAECF7NE0Y65J";
const WORKOS_CLIENT_ID_STAGING = "client_01J0FW6XCPMJMQ3CG51RB4HBZQ";
const PRODUCTION_HUB_ENV = {
    DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api.continue.dev/",
    CONTROL_PLANE_URL: "https://api.continue.dev/",
    AUTH_TYPE: AuthTypes_1.AuthType.WorkOsProd,
    WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_PRODUCTION,
    APP_URL: "https://hub.continue.dev/",
};
const STAGING_ENV = {
    DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api.continue-stage.tools/",
    CONTROL_PLANE_URL: "https://api.continue-stage.tools/",
    AUTH_TYPE: AuthTypes_1.AuthType.WorkOsStaging,
    WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
    APP_URL: "https://hub.continue-stage.tools/",
};
const TEST_ENV = {
    DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api-test.continue.dev/",
    CONTROL_PLANE_URL: "https://api-test.continue.dev/",
    AUTH_TYPE: AuthTypes_1.AuthType.WorkOsStaging,
    WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
    APP_URL: "https://app-test.continue.dev/",
};
const LOCAL_ENV = {
    DEFAULT_CONTROL_PLANE_PROXY_URL: "http://localhost:3001/",
    CONTROL_PLANE_URL: "http://localhost:3001/",
    AUTH_TYPE: AuthTypes_1.AuthType.WorkOsStaging,
    WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
    APP_URL: "http://localhost:3000/",
};
async function enableHubContinueDev() {
    return true;
}
async function getControlPlaneEnv(ideSettingsPromise) {
    const ideSettings = await ideSettingsPromise;
    return getControlPlaneEnvSync(ideSettings.continueTestEnvironment);
}
function getControlPlaneEnvSync(ideTestEnvironment) {
    // MDM override
    const licenseKeyData = (0, mdm_1.getLicenseKeyData)();
    if (licenseKeyData?.unsignedData?.apiUrl) {
        const { apiUrl } = licenseKeyData.unsignedData;
        return {
            AUTH_TYPE: AuthTypes_1.AuthType.OnPrem,
            DEFAULT_CONTROL_PLANE_PROXY_URL: apiUrl,
            CONTROL_PLANE_URL: apiUrl,
            APP_URL: "https://hub.continue.dev/",
        };
    }
    // Note .local overrides .staging
    if (fs.existsSync((0, paths_1.getLocalEnvironmentDotFilePath)())) {
        return LOCAL_ENV;
    }
    if (fs.existsSync((0, paths_1.getStagingEnvironmentDotFilePath)())) {
        return STAGING_ENV;
    }
    const env = ideTestEnvironment === "production"
        ? "hub"
        : ideTestEnvironment === "staging"
            ? "staging"
            : ideTestEnvironment === "local"
                ? "local"
                : process.env.CONTROL_PLANE_ENV;
    return env === "local"
        ? LOCAL_ENV
        : env === "staging"
            ? STAGING_ENV
            : env === "test"
                ? TEST_ENV
                : PRODUCTION_HUB_ENV;
}
async function useHub(ideSettingsPromise) {
    const ideSettings = await ideSettingsPromise;
    return ideSettings.continueTestEnvironment !== "none";
}
//# sourceMappingURL=env.js.map