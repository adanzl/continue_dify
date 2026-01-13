"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_net_1 = __importDefault(require("node:net"));
class LogStashAnalyticsProvider {
    async capture(event, properties) {
        if (this.host === undefined || this.port === undefined) {
            console.warn("LogStashAnalyticsProvider not set up yet.");
        }
        const payload = {
            event,
            properties,
            uniqueId: this.uniqueId,
        };
        const client = new node_net_1.default.Socket();
        client.connect(this.port, this.host, () => {
            client.write(JSON.stringify(payload));
            client.end();
        });
    }
    async setup(config, uniqueId, controlPlaneProxyInfo) {
        if (!config.url) {
            console.warn("LogStashAnalyticsProvider is missing a URL");
            return;
        }
        const url = new URL(config.url);
        this.host = url.hostname;
        this.port = parseInt(url.port);
        this.uniqueId = uniqueId;
    }
    async shutdown() { }
}
exports.default = LogStashAnalyticsProvider;
//# sourceMappingURL=LogStashAnalyticsProvider.js.map