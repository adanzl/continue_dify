"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Providers = void 0;
exports.contextProviderClassFromName = contextProviderClassFromName;
const ClipboardContextProvider_1 = __importDefault(require("./ClipboardContextProvider"));
const CodebaseContextProvider_1 = __importDefault(require("./CodebaseContextProvider"));
const CodeContextProvider_1 = __importDefault(require("./CodeContextProvider"));
const ContinueProxyContextProvider_1 = __importDefault(require("./ContinueProxyContextProvider"));
const CurrentFileContextProvider_1 = __importDefault(require("./CurrentFileContextProvider"));
const DatabaseContextProvider_1 = __importDefault(require("./DatabaseContextProvider"));
const DebugLocalsProvider_1 = __importDefault(require("./DebugLocalsProvider"));
const DiffContextProvider_1 = __importDefault(require("./DiffContextProvider"));
const DiscordContextProvider_1 = __importDefault(require("./DiscordContextProvider"));
const DocsContextProvider_1 = __importDefault(require("./DocsContextProvider"));
const FileContextProvider_1 = __importDefault(require("./FileContextProvider"));
const FileTreeContextProvider_1 = __importDefault(require("./FileTreeContextProvider"));
const FolderContextProvider_1 = __importDefault(require("./FolderContextProvider"));
const GitCommitContextProvider_1 = __importDefault(require("./GitCommitContextProvider"));
const GitHubIssuesContextProvider_1 = __importDefault(require("./GitHubIssuesContextProvider"));
const GitLabMergeRequestContextProvider_1 = __importDefault(require("./GitLabMergeRequestContextProvider"));
const GoogleContextProvider_1 = __importDefault(require("./GoogleContextProvider"));
const GreptileContextProvider_1 = __importDefault(require("./GreptileContextProvider"));
const HttpContextProvider_1 = __importDefault(require("./HttpContextProvider"));
const JiraIssuesContextProvider_1 = __importDefault(require("./JiraIssuesContextProvider/"));
const MCPContextProvider_1 = __importDefault(require("./MCPContextProvider"));
const OpenFilesContextProvider_1 = __importDefault(require("./OpenFilesContextProvider"));
const OSContextProvider_1 = __importDefault(require("./OSContextProvider"));
const PostgresContextProvider_1 = __importDefault(require("./PostgresContextProvider"));
const ProblemsContextProvider_1 = __importDefault(require("./ProblemsContextProvider"));
const RepoMapContextProvider_1 = __importDefault(require("./RepoMapContextProvider"));
const RulesContextProvider_1 = __importDefault(require("./RulesContextProvider"));
const SearchContextProvider_1 = __importDefault(require("./SearchContextProvider"));
const TerminalContextProvider_1 = __importDefault(require("./TerminalContextProvider"));
const URLContextProvider_1 = __importDefault(require("./URLContextProvider"));
const WebContextProvider_1 = __importDefault(require("./WebContextProvider"));
/**
 * Note: We are currently omitting the following providers due to bugs:
 * - `CodeOutlineContextProvider`
 * - `CodeHighlightsContextProvider`
 *
 * See this issue for details: https://github.com/continuedev/continue/issues/1365
 */
exports.Providers = [
    FileContextProvider_1.default,
    DiffContextProvider_1.default,
    FileTreeContextProvider_1.default,
    GitHubIssuesContextProvider_1.default,
    GoogleContextProvider_1.default,
    TerminalContextProvider_1.default,
    DebugLocalsProvider_1.default,
    OpenFilesContextProvider_1.default,
    HttpContextProvider_1.default,
    SearchContextProvider_1.default,
    OSContextProvider_1.default,
    ProblemsContextProvider_1.default,
    FolderContextProvider_1.default,
    DocsContextProvider_1.default,
    GitLabMergeRequestContextProvider_1.default,
    JiraIssuesContextProvider_1.default,
    PostgresContextProvider_1.default,
    DatabaseContextProvider_1.default,
    CodebaseContextProvider_1.default,
    CodeContextProvider_1.default,
    CurrentFileContextProvider_1.default,
    URLContextProvider_1.default,
    ContinueProxyContextProvider_1.default,
    RepoMapContextProvider_1.default,
    DiscordContextProvider_1.default,
    GreptileContextProvider_1.default,
    WebContextProvider_1.default,
    MCPContextProvider_1.default,
    GitCommitContextProvider_1.default,
    ClipboardContextProvider_1.default,
    RulesContextProvider_1.default,
];
function contextProviderClassFromName(name) {
    const provider = exports.Providers.find((cls) => cls.description.title === name);
    return provider;
}
//# sourceMappingURL=index.js.map