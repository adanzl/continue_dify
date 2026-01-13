"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
class ContinueProxyAnalyticsProvider {
    async capture(event, properties) {
        if (!this.controlPlaneProxyInfo?.workspaceId) {
            return;
        }
        const url = new URL(`proxy/analytics/${this.controlPlaneProxyInfo.workspaceId}/capture`, this.controlPlaneProxyInfo?.controlPlaneProxyUrl).toString();
        void (0, node_fetch_1.default)(url, {
            method: "POST",
            body: JSON.stringify({
                event,
                properties,
                uniqueId: this.uniqueId,
            }),
            headers: {
                Authorization: `Bearer ${await this.controlPlaneClient?.getAccessToken()}`,
            },
        });
    }
    async setup(config, uniqueId, controlPlaneProxyInfo) {
        this.uniqueId = uniqueId;
        this.controlPlaneProxyInfo = controlPlaneProxyInfo;
    }
    async shutdown() { }
}
exports.default = ContinueProxyAnalyticsProvider;
//# sourceMappingURL=ContinueProxyAnalyticsProvider.js.map