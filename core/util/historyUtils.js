"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMarkDown = toMarkDown;
exports.shareSession = shareSession;
const fs_1 = __importDefault(require("fs"));
const node_os_1 = require("node:os");
const node_url_1 = require("node:url");
const path_1 = __importDefault(require("path"));
const AutocompleteLanguageInfo_js_1 = require("../autocomplete/constants/AutocompleteLanguageInfo.js");
const messageContent_js_1 = require("../util/messageContent.js");
const paths_js_1 = require("../util/paths.js");
// If useful elsewhere, helper funcs should move to core/util/index.ts or similar
function getOffsetDatetime(date) {
    const offset = date.getTimezoneOffset();
    const offsetHours = Math.floor(offset / 60);
    const offsetMinutes = offset % 60;
    date.setHours(date.getHours() - offsetHours);
    date.setMinutes(date.getMinutes() - offsetMinutes);
    return date;
}
function asBasicISOString(date) {
    const isoString = date.toISOString();
    return isoString.replace(/[-:]|(\.\d+Z)/g, "");
}
function reformatCodeBlocks(msgText) {
    const codeBlockFenceRegex = /```((.*?\.(\w+))\s*.*)\n/g;
    msgText = msgText.replace(codeBlockFenceRegex, (match, metadata, filename, extension) => {
        const lang = (0, AutocompleteLanguageInfo_js_1.languageForFilepath)(filename);
        return `\`\`\`${extension}\n${lang.singleLineComment} ${metadata}\n`;
    });
    // Appease the markdown linter
    return msgText.replace(/```\n```/g, "```\n\n```");
}
function toMarkDown(history, time) {
    if (!time) {
        time = new Date();
    }
    let content = `### [Continue](https://continue.dev) session transcript\n Exported: ${time.toLocaleString()}`;
    for (const msg of history) {
        let msgText = (0, messageContent_js_1.renderChatMessage)(msg);
        if (!msgText) {
            continue; // Skip messages without content
        }
        if (msg.role === "user" && msgText.search("```") > -1) {
            msgText = reformatCodeBlocks(msgText);
        }
        // format messages as blockquotes
        msgText = msgText.replace(/^/gm, "> ");
        content += `\n\n#### ${msg.role === "user" ? "_User_" : "_Assistant_"}\n\n${msgText}`;
    }
    return content;
}
async function shareSession(ide, history, outputDir) {
    const now = new Date();
    const content = toMarkDown(history, now);
    outputDir = outputDir ?? (0, paths_js_1.getContinueGlobalPath)();
    if (outputDir.startsWith("~")) {
        outputDir = outputDir.replace(/^~/, node_os_1.homedir);
    }
    else if (outputDir.startsWith("./") ||
        outputDir.startsWith(".\\") ||
        outputDir === ".") {
        const workspaceDirs = await ide.getWorkspaceDirs();
        // Although the most common situation is to have one directory open in a
        // workspace it's also possible to have just a file open without an
        // associated directory or to use multi-root workspaces in which multiple
        // folders are included. We default to using the first item in the list, if
        // it exists.
        const workspaceDirectory = workspaceDirs?.[0] || "";
        outputDir = outputDir.replace(/^./, (0, node_url_1.fileURLToPath)(workspaceDirectory));
    }
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const dtString = asBasicISOString(getOffsetDatetime(now));
    const outPath = path_1.default.join(outputDir, `${dtString}_session.md`); //TODO: more flexible naming?
    const fileUrl = (0, node_url_1.pathToFileURL)(outPath).toString(); // TODO switch from path to URI above ^
    await ide.writeFile(fileUrl, content);
    await ide.openFile(fileUrl);
    return fileUrl;
}
//# sourceMappingURL=historyUtils.js.map