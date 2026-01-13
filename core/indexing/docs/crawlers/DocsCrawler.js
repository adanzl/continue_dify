"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubCrawler = exports.ChromiumInstaller = exports.ChromiumCrawler = exports.CheerioCrawler = void 0;
const CheerioCrawler_1 = __importDefault(require("./CheerioCrawler"));
exports.CheerioCrawler = CheerioCrawler_1.default;
const ChromiumCrawler_1 = require("./ChromiumCrawler");
Object.defineProperty(exports, "ChromiumCrawler", { enumerable: true, get: function () { return ChromiumCrawler_1.ChromiumCrawler; } });
Object.defineProperty(exports, "ChromiumInstaller", { enumerable: true, get: function () { return ChromiumCrawler_1.ChromiumInstaller; } });
const DefaultCrawler_1 = require("./DefaultCrawler");
const GitHubCrawler_1 = __importDefault(require("./GitHubCrawler"));
exports.GitHubCrawler = GitHubCrawler_1.default;
class DocsCrawler {
    constructor(ide, config, maxDepth = 4, maxRequestsPerCrawl = 1000, useLocalCrawling = false, githubToken = undefined) {
        this.ide = ide;
        this.config = config;
        this.maxDepth = maxDepth;
        this.maxRequestsPerCrawl = maxRequestsPerCrawl;
        this.useLocalCrawling = useLocalCrawling;
        this.githubToken = githubToken;
        this.GITHUB_HOST = "github.com";
        this.chromiumInstaller = new ChromiumCrawler_1.ChromiumInstaller(this.ide, this.config);
    }
    shouldUseChromium() {
        return (this.config.experimental?.useChromiumForDocsCrawling &&
            this.chromiumInstaller.isInstalled());
    }
    /*
      Returns the type of crawler used in the end
    */
    async *crawl(startUrl) {
        if (startUrl.host === this.GITHUB_HOST) {
            yield* new GitHubCrawler_1.default(startUrl, this.githubToken).crawl();
            return "github";
        }
        if (!this.useLocalCrawling) {
            try {
                const pageData = await new DefaultCrawler_1.DefaultCrawler(startUrl, this.maxRequestsPerCrawl, this.maxDepth).crawl();
                if (pageData.length > 0) {
                    yield* pageData;
                    return "default";
                }
            }
            catch (e) {
                console.error("Default crawler failed, trying backup: ", e);
            }
        }
        if (this.shouldUseChromium()) {
            yield* new ChromiumCrawler_1.ChromiumCrawler(startUrl, this.maxRequestsPerCrawl, this.maxDepth).crawl();
            return "chromium";
        }
        else {
            let didCrawlSinglePage = false;
            for await (const pageData of new CheerioCrawler_1.default(startUrl, this.maxRequestsPerCrawl, this.maxDepth).crawl()) {
                yield pageData;
                didCrawlSinglePage = true;
            }
            // We assume that if we failed to crawl a single page,
            // it was due to an error that using Chromium can resolve
            const shouldProposeUseChromium = !didCrawlSinglePage &&
                this.chromiumInstaller.shouldProposeUseChromiumOnCrawlFailure();
            if (shouldProposeUseChromium) {
                const didInstall = await this.chromiumInstaller.proposeAndAttemptInstall(startUrl.toString());
                if (didInstall) {
                    void this.ide.showToast("info", `Successfully installed Chromium! Retrying crawl of: ${startUrl.toString()}`);
                    yield* new ChromiumCrawler_1.ChromiumCrawler(startUrl, this.maxRequestsPerCrawl, this.maxDepth).crawl();
                    return "chromium";
                }
            }
            return "cheerio";
        }
    }
}
exports.default = DocsCrawler;
//# sourceMappingURL=DocsCrawler.js.map