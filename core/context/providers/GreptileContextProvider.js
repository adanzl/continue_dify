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
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_js_1 = require("../index.js");
class GreptileContextProvider extends index_js_1.BaseContextProvider {
    get deprecationMessage() {
        return "The Greptile context provider is now deprecated and will be removed in a later version. Please consider viewing their docs at greptile.com/docs/code-review-bot/auto-resolve-with-mcp for resolving greptile queries.";
    }
    async getContextItems(query, extras) {
        const greptileToken = this.getGreptileToken();
        if (!greptileToken) {
            throw new Error("Greptile token not found.");
        }
        const githubToken = this.getGithubToken();
        if (!githubToken) {
            throw new Error("GitHub token not found.");
        }
        let absPath = await this.getWorkspaceDir(extras);
        if (!absPath) {
            throw new Error("Failed to determine the workspace directory.");
        }
        var remoteUrl = getRemoteUrl(absPath);
        remoteUrl = getRemoteUrl(absPath);
        const repoName = extractRepoName(remoteUrl);
        const branch = getCurrentBranch(absPath);
        const remoteType = getRemoteType(remoteUrl);
        if (!remoteType) {
            throw new Error("Unable to determine remote type.");
        }
        const options = {
            method: "POST",
            headers: {
                Authorization: `Bearer ${greptileToken}`,
                "X-GitHub-Token": githubToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: [{ id: "<string>", content: query, role: "user" }],
                repositories: [
                    {
                        remote: remoteType,
                        branch: branch,
                        repository: repoName,
                    },
                ],
                sessionId: extras.config.userToken || "default-session",
                stream: false,
                genius: true,
            }),
        };
        try {
            const response = await extras.fetch("https://api.greptile.com/v2/query", options);
            const rawText = await response.text();
            // Check for HTTP errors
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Parse the response as JSON
            try {
                const json = JSON.parse(rawText);
                return json.sources.map((source) => ({
                    description: source.filepath,
                    content: `File: ${source.filepath}\nLines: ${source.linestart}-${source.lineend}\n\n${source.summary}`,
                    name: (source.filepath.split("/").pop() ?? "").split("\\").pop() ?? "",
                }));
            }
            catch (jsonError) {
                throw new Error(`Failed to parse Greptile response:\n${rawText}`);
            }
        }
        catch (error) {
            console.error("Error getting context items from Greptile:", error);
            throw new Error("Error getting context items from Greptile");
        }
    }
    getGreptileToken() {
        return this.options.GreptileToken || process.env.GREPTILE_AUTH_TOKEN;
    }
    getGithubToken() {
        return this.options.GithubToken || process.env.GITHUB_TOKEN;
    }
    async getWorkspaceDir(extras) {
        try {
            const workspaceDirs = await extras.ide.getWorkspaceDirs();
            if (workspaceDirs && workspaceDirs.length > 0) {
                return workspaceDirs[0];
            }
            else {
                console.warn("extras.ide.getWorkspaceDirs() returned undefined or empty array.");
            }
        }
        catch (err) {
            console.warn("Failed to get workspace directories from extras.ide.getWorkspaceDirs():");
        }
        // Fallback to using Git commands
        try {
            const currentDir = process.cwd();
            if (this.isGitRepository(currentDir)) {
                const workspaceDir = (0, child_process_1.execSync)("git rev-parse --show-toplevel")
                    .toString()
                    .trim();
                return workspaceDir;
            }
            else {
                console.warn(`Current directory is not a Git repository: ${currentDir}`);
                return null;
            }
        }
        catch (err) {
            console.warn("Failed to get workspace directory using Git commands: ");
            return null;
        }
    }
    isGitRepository(dir) {
        try {
            const gitDir = path.join(dir, ".git");
            return fs.existsSync(gitDir);
        }
        catch (err) {
            console.warn("Failed to check if directory is a Git repository:");
            return false;
        }
    }
}
GreptileContextProvider.description = {
    title: "greptile",
    displayTitle: "Greptile",
    description: "Insert query to Greptile",
    type: "query",
};
// Helper functions
function getRemoteUrl(absPath) {
    try {
        const remote = (0, child_process_1.execSync)(`git -C ${absPath} remote get-url origin`)
            .toString()
            .trim();
        return remote;
    }
    catch (err) {
        console.warn("Failed to get remote URL");
        return "";
    }
}
function getCurrentBranch(absPath) {
    try {
        const branch = (0, child_process_1.execSync)(`git -C ${absPath} rev-parse --abbrev-ref HEAD`)
            .toString()
            .trim();
        return branch;
    }
    catch (err) {
        console.warn("Failed to get current branch");
        return "master"; // Default to 'master' if the current branch cannot be determined
    }
}
function extractRepoName(remote) {
    if (remote.startsWith("http://") || remote.startsWith("https://")) {
        const parts = remote.split("/");
        if (parts.length >= 2) {
            return (parts[parts.length - 2] +
                "/" +
                parts[parts.length - 1].replace(".git", ""));
        }
    }
    else if (remote.startsWith("git@")) {
        const parts = remote.split(":");
        if (parts.length >= 2) {
            return parts[1].replace(".git", "");
        }
    }
    return "";
}
function getRemoteType(remote) {
    if (remote.includes("github.com")) {
        return "github";
    }
    else if (remote.includes("gitlab.com")) {
        return "gitlab";
    }
    else if (remote.includes("azure.com")) {
        return "azure";
    }
    return "";
}
exports.default = GreptileContextProvider;
//# sourceMappingURL=GreptileContextProvider.js.map