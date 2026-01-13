"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLegacyBuiltInSlashCommandFromDescription = getLegacyBuiltInSlashCommandFromDescription;
const cmd_1 = __importDefault(require("./cmd"));
const commit_1 = __importDefault(require("./commit"));
const draftIssue_1 = __importDefault(require("./draftIssue"));
const http_1 = __importDefault(require("./http"));
const onboard_1 = __importDefault(require("./onboard"));
const review_1 = __importDefault(require("./review"));
const share_1 = __importDefault(require("./share"));
const LegacyBuiltInSlashCommands = [
    draftIssue_1.default,
    share_1.default,
    cmd_1.default,
    http_1.default,
    commit_1.default,
    review_1.default,
    onboard_1.default,
];
function getLegacyBuiltInSlashCommandFromDescription(desc) {
    const cmd = LegacyBuiltInSlashCommands.find((cmd) => cmd.name === desc.name);
    if (!cmd) {
        return undefined;
    }
    return {
        ...cmd,
        params: desc.params,
        description: desc.description ?? cmd.description,
        source: "built-in-legacy",
    };
}
//# sourceMappingURL=index.js.map