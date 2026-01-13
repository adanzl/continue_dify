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
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class GitHubIssuesContextProvider extends index_js_1.BaseContextProvider {
    get deprecationMessage() {
        return "The GitHub issues context provider is now deprecated and will be removed in a later version. Please consider using the GitHub MCP server (https://hub.continue.dev/anthropic/github-mcp) instead.";
    }
    async getContextItems(query, extras) {
        const issueId = query;
        const { Octokit } = await Promise.resolve().then(() => __importStar(require("@octokit/rest")));
        const octokit = new Octokit({
            auth: this.options?.githubToken,
            baseUrl: this.options?.domain
                ? `https://${this.options.domain}/api/v3`
                : undefined,
            request: {
                fetch: extras.fetch,
            },
        });
        const { owner, repo, issue_number } = JSON.parse(issueId);
        const issue = await octokit.issues.get({
            owner,
            repo,
            issue_number,
        });
        let content = `# GitHub Issue #${issue.data.number.toString()} in ${owner}/${repo}`;
        const comments = await octokit.issues.listComments({
            owner,
            repo,
            issue_number,
        });
        const parts = [
            issue.data.body || "No description",
            ...comments.data.map((comment) => comment.body),
        ];
        content += `\n\n${parts.join("\n\n---\n\n")}`;
        return [
            {
                name: issue.data.title,
                content,
                description: `#${issue.data.number.toString()}`,
            },
        ];
    }
    async loadSubmenuItems(args) {
        const { Octokit } = await Promise.resolve().then(() => __importStar(require("@octokit/rest")));
        const octokit = new Octokit({
            auth: this.options?.githubToken,
            request: {
                fetch: args.fetch,
            },
        });
        const allIssues = [];
        for (const repo of this.options?.repos) {
            const issues = await octokit.issues.listForRepo({
                owner: repo.owner,
                repo: repo.repo,
                state: repo.type || "open",
            });
            allIssues.push(...issues.data.map((issue) => ({
                title: issue.title,
                description: `#${issue.number.toString()}`,
                id: JSON.stringify({
                    owner: repo.owner,
                    repo: repo.repo,
                    issue_number: issue.number,
                }),
            })));
        }
        return allIssues;
    }
}
GitHubIssuesContextProvider.description = {
    title: "issue",
    displayTitle: "GitHub Issues",
    description: "Reference GitHub issues",
    type: "submenu",
};
exports.default = GitHubIssuesContextProvider;
//# sourceMappingURL=GitHubIssuesContextProvider.js.map