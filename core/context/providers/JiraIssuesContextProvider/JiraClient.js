"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraClient = void 0;
// @ts-ignore
const adf_to_md_1 = __importDefault(require("adf-to-md"));
class JiraClient {
    constructor(options) {
        this.options = {
            issueQuery: "assignee = currentUser() AND resolution = Unresolved order by updated DESC",
            apiVersion: "3",
            requestOptions: {},
            maxResults: "50",
            ...options,
        };
        this.baseUrl = `https://${this.options.domain}/rest/api/${this.options.apiVersion}`;
        this.authHeader = this.options.username
            ? {
                Authorization: `Basic ${btoa(`${this.options.username}:${this.options.password}`)}`,
            }
            : {
                Authorization: `Bearer ${this.options.password}`,
            };
    }
    async issue(issueId, customFetch) {
        const result = {};
        const response = await customFetch(new URL(this.baseUrl + `/issue/${issueId}?fields=description,comment,summary`), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...this.authHeader,
            },
        });
        const issue = (await response.json());
        result.key = issue.key;
        result.summary = issue.fields.summary;
        if (typeof issue.fields.description === "string") {
            result.description = issue.fields.description;
        }
        else if (issue.fields.description) {
            result.description = adf_to_md_1.default.validate(issue.fields.description).result;
        }
        else {
            result.description = "";
        }
        result.comments =
            issue.fields.comment?.comments?.map((comment) => {
                const body = typeof comment.body === "string"
                    ? comment.body
                    : adf_to_md_1.default.validate(comment.body).result;
                return {
                    body,
                    author: comment.author,
                    created: comment.created,
                    updated: comment.updated,
                };
            }) ?? [];
        return result;
    }
    async listIssues(customFetch) {
        const response = await customFetch(new URL(this.baseUrl +
            `/search?fields=summary&jql=${this.options.issueQuery ??
                "assignee = currentUser() AND resolution = Unresolved order by updated DESC"}&maxResults=${this.options.maxResults ?? "50"}`), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...this.authHeader,
            },
        });
        if (response.status === 500) {
            const text = await response.text();
            console.warn("Unable to get Jira tickets. You may need to set 'apiVersion': 2 in your config.json. See full documentation here: https://docs.continue.dev/customize/context-providers#jira-datacenter-support\n\n", text);
            return Promise.resolve([]);
        }
        else if (response.status !== 200) {
            const text = await response.text();
            console.warn("Unable to get Jira tickets: ", text);
            return Promise.resolve([]);
        }
        const data = (await response.json());
        return (data.issues?.map((issue) => ({
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
        })) ?? []);
    }
}
exports.JiraClient = JiraClient;
//# sourceMappingURL=JiraClient.js.map