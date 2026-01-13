"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = generateRepoMap;
const node_fs_1 = __importDefault(require("node:fs"));
const CodeSnippetsIndex_1 = require("../indexing/CodeSnippetsIndex");
const walkDir_1 = require("../indexing/walkDir");
const countTokens_1 = require("../llm/countTokens");
const paths_1 = require("./paths");
const uri_1 = require("./uri");
class RepoMapGenerator {
    constructor(llm, ide, options) {
        this.llm = llm;
        this.ide = ide;
        this.options = options;
        this.repoMapPath = (0, paths_1.getRepoMapFilePath)();
        this.writeStream = node_fs_1.default.createWriteStream(this.repoMapPath);
        this.contentTokens = 0;
        this.dirs = [];
        this.allUris = [];
        this.pathsInDirsWithSnippets = new Set();
        this.SNIPPETS_BATCH_SIZE = 100;
        this.URI_BATCH_SIZE = 100;
        this.REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;
        this.PREAMBLE = "Below is a repository map. \n" +
            "For each file in the codebase, " +
            "this map contains the name of the file, and the signature for any " +
            "classes, methods, or functions in the file.\n\n";
        this.maxRepoMapTokens =
            llm.contextLength * this.REPO_MAX_CONTEXT_LENGTH_RATIO;
    }
    getUriForWrite(uri) {
        if (this.options.outputRelativeUriPaths) {
            return (0, uri_1.findUriInDirs)(uri, this.dirs).relativePathOrBasename;
        }
        return uri;
    }
    async generate() {
        this.dirs = this.options.dirUris ?? (await this.ide.getWorkspaceDirs());
        this.allUris = await (0, walkDir_1.walkDirs)(this.ide, {
            source: "generate repo map",
        }, this.dirs);
        // Initialize
        await this.writeToStream(this.PREAMBLE);
        if (this.options.includeSignatures) {
            // Process uris and signatures
            let snippetOffset = 0;
            let uriOffset = 0;
            while (true) {
                const { groupedByUri, hasMoreSnippets, hasMoreUris } = await CodeSnippetsIndex_1.CodeSnippetsCodebaseIndex.getPathsAndSignatures(this.allUris, uriOffset, this.URI_BATCH_SIZE, snippetOffset, this.SNIPPETS_BATCH_SIZE);
                // process batch
                for (const [uri, signatures] of Object.entries(groupedByUri)) {
                    let fileContent;
                    try {
                        fileContent = await this.ide.readFile(uri);
                    }
                    catch (err) {
                        console.error("Failed to read file:\n" +
                            `  Uri: ${uri}\n` +
                            `  Error: ${err instanceof Error ? err.message : String(err)}`);
                        continue;
                    }
                    const filteredSignatures = signatures.filter((signature) => signature.trim() !== fileContent.trim());
                    if (filteredSignatures.length > 0) {
                        this.pathsInDirsWithSnippets.add(uri);
                    }
                    let content = `${this.getUriForWrite(uri)}:\n`;
                    for (const signature of signatures.slice(0, -1)) {
                        content += `${this.indentMultilineString(signature)}\n\t...\n`;
                    }
                    content += `${this.indentMultilineString(signatures[signatures.length - 1])}\n\n`;
                    if (content) {
                        await this.writeToStream(content);
                    }
                }
                if (this.contentTokens >= this.maxRepoMapTokens) {
                    break;
                }
                if (hasMoreSnippets) {
                    snippetOffset += this.SNIPPETS_BATCH_SIZE;
                }
                else if (hasMoreUris) {
                    snippetOffset = 0;
                    uriOffset += this.URI_BATCH_SIZE;
                }
                else {
                    break;
                }
            }
            // Remaining Uris just so that written repo map isn't incomplete
            const urisWithoutSnippets = this.allUris.filter((uri) => !this.pathsInDirsWithSnippets.has(uri));
            if (urisWithoutSnippets.length > 0) {
                await this.writeToStream(urisWithoutSnippets.map((uri) => this.getUriForWrite(uri)).join("\n"));
            }
        }
        else {
            // Only process uris
            await this.writeToStream(this.allUris.map((uri) => this.getUriForWrite(uri)).join("\n"));
        }
        this.writeStream.end();
        if (this.contentTokens >= this.maxRepoMapTokens) {
            console.debug("Full repo map was unable to be generated due to context window limitations");
        }
        return node_fs_1.default.readFileSync(this.repoMapPath, "utf8");
    }
    async writeToStream(content) {
        const tokens = this.llm.countTokens(content);
        if (this.contentTokens + tokens > this.maxRepoMapTokens) {
            content = (0, countTokens_1.pruneLinesFromTop)(content, this.maxRepoMapTokens - this.contentTokens, this.llm.model);
        }
        this.contentTokens += this.llm.countTokens(content);
        await new Promise((resolve) => this.writeStream.write(content, resolve));
    }
    indentMultilineString(str) {
        return str
            .split("\n")
            .map((line) => "\t" + line)
            .join("\n");
    }
}
async function generateRepoMap(llm, ide, options) {
    const generator = new RepoMapGenerator(llm, ide, options);
    return generator.generate();
}
//# sourceMappingURL=generateRepoMap.js.map