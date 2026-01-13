"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../index.js");
class OSContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const cpu = os_1.default.arch();
        const platform = os_1.default.platform();
        return [
            {
                description: "Your operating system and CPU",
                content: `I am running ${platform === "win32" ? "Windows" : platform} on ${cpu}.`,
                name: "Operating System",
            },
        ];
    }
}
OSContextProvider.description = {
    title: "os",
    displayTitle: "Operating System",
    description: "Operating system and CPU Information.",
    type: "normal",
};
exports.default = OSContextProvider;
//# sourceMappingURL=OSContextProvider.js.map