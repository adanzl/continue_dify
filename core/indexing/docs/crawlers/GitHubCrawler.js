"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_url_1 = require("node:url");
const rest_1 = require("@octokit/rest");
class GitHubCrawler {
    constructor(startUrl, githubToken) {
        this.startUrl = startUrl;
        this.githubToken = githubToken;
        this.markdownRegex = new RegExp(/\.(md|mdx)$/);
        this.FILES_TO_SKIP = [/TEMPLATE\.md$/, /template\.md$/];
        this.octokit = new rest_1.Octokit({ auth: this.githubToken });
    }
    async *crawl() {
        console.debug(`[${this.constructor.name}] Crawling GitHub repo: ${this.startUrl.toString()}`);
        const [_, owner, repo] = this.startUrl.pathname.split("/");
        const branch = await this.getGithubRepoDefaultBranch(owner, repo);
        const paths = await this.getGitHubRepoPaths(owner, repo, branch);
        for await (const path of paths) {
            if (this.FILES_TO_SKIP.some((skip) => skip.test(path))) {
                continue;
            }
            const content = await this.getGithubRepoFileContent(path, owner, repo);
            const fullUrl = new node_url_1.URL(this.startUrl.toString());
            fullUrl.pathname += `/tree/${branch}/${path}`;
            yield { path, url: fullUrl.toString(), content: content ?? "" };
        }
    }
    async getGithubRepoDefaultBranch(owner, repo) {
        const repoInfo = await this.octokit.repos.get({ owner, repo });
        return repoInfo.data.default_branch;
    }
    async getGitHubRepoPaths(owner, repo, branch) {
        const tree = await this.octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: branch,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
            recursive: "true",
        });
        return tree.data.tree
            .filter((file) => file.type === "blob" && this.markdownRegex.test(file.path ?? ""))
            .map((file) => file.path);
    }
    async getGithubRepoFileContent(path, owner, repo) {
        try {
            const response = await this.octokit.repos.getContent({
                owner,
                repo,
                path,
                headers: { Accept: "application/vnd.github.raw+json" },
            });
            return response.data;
        }
        catch (error) {
            console.debug("Error fetching file contents:", error);
            return null;
        }
    }
}
exports.default = GitHubCrawler;
//# sourceMappingURL=GitHubCrawler.js.map