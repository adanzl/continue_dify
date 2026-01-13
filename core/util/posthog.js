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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = exports.EXPERIMENTS = exports.PosthogFeatureFlag = void 0;
const node_os_1 = __importDefault(require("node:os"));
const TeamAnalytics_js_1 = require("../control-plane/TeamAnalytics.js");
const extractMinimalStackTraceInfo_js_1 = require("./extractMinimalStackTraceInfo.js");
const TokensBatchingService_js_1 = require("./TokensBatchingService.js");
var PosthogFeatureFlag;
(function (PosthogFeatureFlag) {
    PosthogFeatureFlag["AutocompleteTimeout"] = "autocomplete-timeout";
    PosthogFeatureFlag["RecentlyVisitedRangesNumSurroundingLines"] = "recently-visited-ranges-num-surrounding-lines";
})(PosthogFeatureFlag || (exports.PosthogFeatureFlag = PosthogFeatureFlag = {}));
exports.EXPERIMENTS = {
    [PosthogFeatureFlag.AutocompleteTimeout]: {
        control: { value: 150 },
        "250": { value: 250 },
        "350": { value: 350 },
        "450": { value: 450 },
    },
    [PosthogFeatureFlag.RecentlyVisitedRangesNumSurroundingLines]: {
        control: { value: null },
        "5": { value: 5 },
        "10": { value: 10 },
        "15": { value: 15 },
        "20": { value: 20 },
    },
};
class Telemetry {
    /**
     * Convenience method for capturing errors in a single event
     */
    static async captureError(errorName, error) {
        if (!(error instanceof Error)) {
            return;
        }
        await Telemetry.capture("extension_error_caught", {
            errorName,
            message: error.message,
            stack: (0, extractMinimalStackTraceInfo_js_1.extractMinimalStackTraceInfo)(error.stack),
        }, false);
    }
    static async capture(event, properties, sendToTeam = false, isExtensionActivationError = false) {
        try {
            const augmentedProperties = {
                ...properties,
                os: Telemetry.os,
                extensionVersion: Telemetry.ideInfo?.extensionVersion,
                ideName: Telemetry.ideInfo?.name,
                ideType: Telemetry.ideInfo?.ideType,
            };
            const payload = {
                distinctId: Telemetry.uniqueId,
                event,
                properties: augmentedProperties,
                sendFeatureFlags: true,
            };
            // In cases where an extremely early fatal error occurs, we may not have initialized yet
            if (isExtensionActivationError && !Telemetry.client) {
                const client = await Telemetry.getTelemetryClient();
                client?.capture(payload);
                return;
            }
            if (process.env.NODE_ENV === "test") {
                return;
            }
            Telemetry.client?.capture(payload);
            if (sendToTeam) {
                void TeamAnalytics_js_1.TeamAnalytics.capture(event, properties);
            }
        }
        catch (e) {
            console.error(`Failed to capture event: ${e}`);
        }
    }
    static shutdownPosthogClient() {
        TokensBatchingService_js_1.TokensBatchingService.getInstance().shutdown();
        Telemetry.client?.shutdown();
    }
    static async getTelemetryClient() {
        try {
            const { PostHog } = await Promise.resolve().then(() => __importStar(require("posthog-node")));
            return new PostHog("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
                host: "https://app.posthog.com",
            });
        }
        catch (e) {
            console.error(`Failed to setup telemetry: ${e}`);
        }
    }
    static async setup(allow, uniqueId, ideInfo) {
        Telemetry.uniqueId = uniqueId;
        Telemetry.os = node_os_1.default.platform();
        Telemetry.ideInfo = ideInfo;
        if (!allow || process.env.NODE_ENV === "test") {
            Telemetry.client = undefined;
        }
        else if (!Telemetry.client) {
            Telemetry.client = await Telemetry.getTelemetryClient();
        }
    }
    static async getFeatureFlag(flag) {
        const value = Telemetry.client?.getFeatureFlag(flag, Telemetry.uniqueId);
        Telemetry.featureValueCache[flag] = value;
        return value;
    }
    static async getValueForFeatureFlag(flag) {
        try {
            if (Telemetry.featureValueCache[flag]) {
                return Telemetry.featureValueCache[flag];
            }
            const userGroup = await Telemetry.getFeatureFlag(flag);
            if (typeof userGroup === "string") {
                return exports.EXPERIMENTS[flag][userGroup].value;
            }
            return undefined;
        }
        catch {
            return undefined;
        }
    }
}
exports.Telemetry = Telemetry;
// Set to undefined whenever telemetry is disabled
Telemetry.client = undefined;
Telemetry.uniqueId = "NOT_UNIQUE";
Telemetry.os = undefined;
Telemetry.ideInfo = undefined;
Telemetry.featureValueCache = {};
//# sourceMappingURL=posthog.js.map