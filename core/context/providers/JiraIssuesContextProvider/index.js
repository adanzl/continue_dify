"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../../index.js");
const JiraClient_js_1 = require("./JiraClient.js");
class JiraIssuesContextProvider extends index_js_1.BaseContextProvider {
    get deprecationMessage() {
        return "The Jira issues context provider is now deprecated and will be removed in a later version. Please consider using the official Atlassian MCP server atlassian.com/platform/remote-mcp-server.";
    }
    getApi() {
        return new JiraClient_js_1.JiraClient({
            domain: this.options.domain,
            username: this.options.email,
            password: this.options.token,
            issueQuery: this.options.issueQuery,
            apiVersion: this.options.apiVersion,
            requestOptions: this.options.requestOptions,
            maxResults: this.options.maxResults,
        });
    }
    async getContextItems(query, extras) {
        const api = this.getApi();
        const issue = await api.issue(query, extras.fetch);
        const parts = [
            `# Jira Issue ${issue.key}: ${issue.summary}`,
            "## Description",
            issue.description ?? "No description",
        ];
        if (issue.comments.length > 0) {
            parts.push("## Comments");
            parts.push(...issue.comments.map((comment) => {
                return `### ${comment.author.displayName} on ${comment.created}\n\n${comment.body}`;
            }));
        }
        const content = parts.join("\n\n");
        return [
            {
                name: `${issue.key}: ${issue.summary}`,
                content,
                description: issue.key,
            },
        ];
    }
    async loadSubmenuItems(args) {
        const api = await this.getApi();
        try {
            const issues = await api.listIssues(args.fetch);
            return issues.map((issue) => ({
                id: issue.id,
                title: `${issue.key}: ${issue.summary}`,
                description: "",
            }));
        }
        catch (ex) {
            console.error(`Unable to get jira tickets: ${ex}`);
            return [];
        }
    }
}
JiraIssuesContextProvider.description = {
    title: "jira",
    displayTitle: "Jira Issues",
    description: "Reference Jira issues",
    type: "submenu",
};
exports.default = JiraIssuesContextProvider;
//# sourceMappingURL=index.js.map