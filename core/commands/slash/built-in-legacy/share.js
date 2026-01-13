"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_url_1 = require("node:url");
const path_1 = __importDefault(require("path"));
const historyUtils_js_1 = require("../../../util/historyUtils.js");
const ShareSlashCommand = {
    name: "share",
    description: "Export the current chat session to markdown",
    run: async function* ({ ide, history, params }) {
        const fileUrl = await (0, historyUtils_js_1.shareSession)(ide, history, params?.outputDir);
        const filePath = (0, node_url_1.fileURLToPath)(fileUrl);
        // output path is the parent directory of the filePath
        const outPath = path_1.default.dirname(filePath);
        yield `The session transcript has been saved to a markdown file at \`${outPath}\`.`;
    },
};
exports.default = ShareSlashCommand;
//# sourceMappingURL=share.js.map