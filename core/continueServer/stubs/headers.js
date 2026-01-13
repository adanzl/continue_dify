"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeaders = getHeaders;
const constants_js_1 = require("../../deploy/constants.js");
const posthog_js_1 = require("../../util/posthog.js");
async function getHeaders() {
    return {
        key: constants_js_1.constants.c,
        timestamp: (0, constants_js_1.getTimestamp)(),
        v: "1",
        extensionVersion: posthog_js_1.Telemetry.ideInfo?.extensionVersion ?? "0.0.0",
        os: posthog_js_1.Telemetry.os ?? "Unknown",
        uniqueId: posthog_js_1.Telemetry.uniqueId ?? "None",
    };
}
//# sourceMappingURL=headers.js.map