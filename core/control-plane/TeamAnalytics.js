"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamAnalytics = void 0;
const node_os_1 = __importDefault(require("node:os"));
const ContinueProxyAnalyticsProvider_js_1 = __importDefault(require("./analytics/ContinueProxyAnalyticsProvider.js"));
const LogStashAnalyticsProvider_js_1 = __importDefault(require("./analytics/LogStashAnalyticsProvider.js"));
const PostHogAnalyticsProvider_js_1 = __importDefault(require("./analytics/PostHogAnalyticsProvider.js"));
function createAnalyticsProvider(config) {
    // @ts-ignore
    switch (config.provider) {
        case "posthog":
            return new PostHogAnalyticsProvider_js_1.default();
        case "logstash":
            return new LogStashAnalyticsProvider_js_1.default();
        case "continue-proxy":
            return new ContinueProxyAnalyticsProvider_js_1.default();
        default:
            return undefined;
    }
}
class TeamAnalytics {
    static async capture(event, properties) {
        void TeamAnalytics.provider?.capture(event, {
            ...properties,
            os: TeamAnalytics.os,
            extensionVersion: TeamAnalytics.extensionVersion,
        });
    }
    static async setup(config, uniqueId, extensionVersion, controlPlaneClient, controlPlaneProxyInfo) {
        TeamAnalytics.uniqueId = uniqueId;
        TeamAnalytics.os = node_os_1.default.platform();
        TeamAnalytics.extensionVersion = extensionVersion;
        TeamAnalytics.provider = createAnalyticsProvider(config);
        await TeamAnalytics.provider?.setup(config, uniqueId, controlPlaneProxyInfo);
        if (config.provider === "continue-proxy") {
            TeamAnalytics.provider.controlPlaneClient = controlPlaneClient;
        }
    }
    static async shutdown() {
        if (TeamAnalytics.provider) {
            await TeamAnalytics.provider.shutdown();
            TeamAnalytics.provider = undefined;
            TeamAnalytics.os = undefined;
            TeamAnalytics.extensionVersion = undefined;
            TeamAnalytics.uniqueId = "NOT_UNIQUE";
        }
    }
}
exports.TeamAnalytics = TeamAnalytics;
TeamAnalytics.provider = undefined;
TeamAnalytics.uniqueId = "NOT_UNIQUE";
TeamAnalytics.os = undefined;
TeamAnalytics.extensionVersion = undefined;
//# sourceMappingURL=TeamAnalytics.js.map