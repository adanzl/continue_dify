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
const axios_1 = require("axios");
const index_js_1 = require("../index.js");
const trimFirstElement = (args) => {
    return args[0].trim();
};
const getSubprocess = async (extras) => {
    const workingDir = await extras.ide.getWorkspaceDirs().then(trimFirstElement);
    return (command) => extras.ide.subprocess(command, workingDir).then(trimFirstElement);
};
class GitLabMergeRequestContextProvider extends index_js_1.BaseContextProvider {
    get deprecationMessage() {
        return "The Gitlab Merge Request context provider is now deprecated and will be removed in a later version. Please consider using the GitLab MCP (https://hub.continue.dev/docker/mcp-gitlab) instead.";
    }
    async getApi() {
        const { default: Axios } = await Promise.resolve().then(() => __importStar(require("axios")));
        const domain = this.options.domain ?? "gitlab.com";
        const token = this.options.token;
        if (!token) {
            throw new Error("GitLab Private Token is required!");
        }
        return Axios.create({
            baseURL: `https://${domain ?? "gitlab.com"}/api/v4`,
            headers: {
                "PRIVATE-TOKEN": token,
            },
        });
    }
    async getRemoteBranchInfo(extras) {
        const subprocess = await getSubprocess(extras);
        const branchName = await subprocess("git branch --show-current");
        const branchRemote = await subprocess(`git config branch.${branchName}.remote`);
        const branchInfo = await subprocess("git branch -vv");
        const currentBranchInfo = branchInfo
            .split("\n")
            .find((line) => line.startsWith("*"));
        const remoteMatches = RegExp(`\\[${branchRemote}/(?<remote_branch>[^\\]]+)\\]`).exec(currentBranchInfo);
        console.dir({ remoteMatches });
        const remoteBranch = remoteMatches?.groups?.remote_branch ?? null;
        const remoteUrl = await subprocess(`git remote get-url ${branchRemote}`);
        let urlMatches;
        if (/https?.*/.test(remoteUrl)) {
            const pathname = new URL(remoteUrl).pathname;
            urlMatches = /\/(?<projectPath>.*?)(?:(?=\.git)|$)/.exec(pathname);
        }
        else {
            // ssh
            urlMatches = /:(?<projectPath>.*).git/.exec(remoteUrl);
        }
        const project = urlMatches?.groups?.projectPath ?? null;
        return {
            branch: remoteBranch,
            project,
        };
    }
    async getContextItems(query, extras) {
        const { branch, project } = await this.getRemoteBranchInfo(extras);
        const api = await this.getApi();
        const result = [];
        try {
            const mergeRequests = await api
                .get(`/projects/${encodeURIComponent(project)}/merge_requests`, {
                params: {
                    source_branch: branch,
                    state: "opened",
                },
            })
                .then((x) => x.data);
            const subprocess = await getSubprocess(extras);
            for (const mergeRequest of mergeRequests) {
                const parts = [
                    `# GitLab Merge Request\ntitle: "${mergeRequest.title}"\ndescription: "${mergeRequest.description ?? "None"}"`,
                    "## Comments",
                ];
                const comments = await api.get(`/projects/${mergeRequest.project_id}/merge_requests/${mergeRequest.iid}/notes`, {
                    params: {
                        sort: "asc",
                        order_by: "created_at",
                    },
                });
                const filteredComments = comments.data.filter((x) => x.type === "DiffNote");
                const locations = {};
                for (const comment of filteredComments) {
                    const filename = comment.position?.new_path ?? "general";
                    if (!locations[filename]) {
                        locations[filename] = [];
                    }
                    locations[filename].push(comment);
                }
                if (extras.selectedCode.length && this.options.filterComments) {
                    const toRemove = Object.keys(locations).filter((filename) => !extras.selectedCode.find((selection) => selection.filepath.endsWith(filename)) && filename !== "general");
                    for (const filepath of toRemove) {
                        delete locations[filepath];
                    }
                }
                const commentFormatter = async (comment) => {
                    const commentLabel = comment.body.includes("```suggestion")
                        ? "Code Suggestion"
                        : "Comment";
                    let result = `#### ${commentLabel}\nauthor: "${comment.author.name}"\ndate: "${comment.created_at}"\nresolved: ${comment.resolved ? "Yes" : "No"}`;
                    if (comment.position?.new_line) {
                        result += `\nline: ${comment.position.new_line}`;
                        if (comment.position.head_sha) {
                            const sourceLines = await subprocess(`git show ${comment.position.head_sha}:${comment.position.new_path}`)
                                .then((result) => result.split("\n"))
                                .catch((ex) => []);
                            const line = comment.position.new_line <= sourceLines.length
                                ? sourceLines[comment.position.new_line - 1]
                                : null;
                            if (line) {
                                result += `\nsource: \`${line}\``;
                            }
                        }
                    }
                    result += `\n\n${comment.body}`;
                    return result;
                };
                for (const [filename, locationComments] of Object.entries(locations)) {
                    if (filename !== "general") {
                        parts.push(`### File ${filename}`);
                        locationComments.sort((a, b) => (a.position?.new_line ?? 0) - (b.position?.new_line ?? 0));
                    }
                    else {
                        parts.push("### General");
                    }
                    const commentSections = await Promise.all(locationComments.map(commentFormatter));
                    parts.push(...commentSections);
                }
                const content = parts.join("\n\n");
                result.push({
                    name: mergeRequest.title,
                    content,
                    description: "Comments from the Merge Request for this branch.",
                });
            }
        }
        catch (ex) {
            let content = "# GitLab Merge Request\n\nError getting merge request. ";
            if (ex instanceof axios_1.AxiosError) {
                if (ex.response) {
                    const errorMessage = ex.response?.data
                        ? (ex.response.data.message ?? JSON.stringify(ex.response?.data))
                        : `${ex.response.status}: ${ex.response.statusText}`;
                    content += `GitLab Error: ${errorMessage}`;
                }
                else {
                    content += `GitLab Request Error ${ex.request}`;
                }
            }
            else {
                // @ts-ignore
                content += `Unknown error: ${ex.message ?? JSON.stringify(ex)}`;
            }
            result.push({
                name: "GitLab Merge Request",
                content,
                description: "Error getting the Merge Request for this branch.",
            });
        }
        return result;
    }
}
GitLabMergeRequestContextProvider.description = {
    title: "gitlab-mr",
    displayTitle: "GitLab Merge Request",
    description: "Reference comments in a GitLab Merge Request",
    type: "normal",
};
exports.default = GitLabMergeRequestContextProvider;
//# sourceMappingURL=GitLabMergeRequestContextProvider.js.map