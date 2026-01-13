"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkDocumentWithoutId = chunkDocumentWithoutId;
exports.chunkDocument = chunkDocument;
exports.shouldChunk = shouldChunk;
const countTokens_js_1 = require("../../llm/countTokens.js");
const treeSitter_js_1 = require("../../util/treeSitter.js");
const uri_js_1 = require("../../util/uri.js");
const basic_js_1 = require("./basic.js");
const code_js_1 = require("./code.js");
async function* chunkDocumentWithoutId(fileUri, contents, maxChunkSize) {
    if (contents.trim() === "") {
        return;
    }
    const extension = (0, uri_js_1.getUriFileExtension)(fileUri);
    // Files that should use basicChunker despite having tree-sitter support
    // These files don't have code structure (classes/functions) that codeChunker expects
    const NON_CODE_EXTENSIONS = [
        "css",
        "html",
        "htm",
        "json",
        "toml",
        "yaml",
        "yml",
    ];
    if (extension in treeSitter_js_1.supportedLanguages &&
        !NON_CODE_EXTENSIONS.includes(extension)) {
        try {
            for await (const chunk of (0, code_js_1.codeChunker)(fileUri, contents, maxChunkSize)) {
                yield chunk;
            }
            return;
        }
        catch (e) {
            // falls back to basicChunker
        }
    }
    yield* (0, basic_js_1.basicChunker)(contents, maxChunkSize);
}
async function* chunkDocument({ filepath, contents, maxChunkSize, digest, }) {
    let index = 0;
    const chunkPromises = [];
    for await (const chunkWithoutId of chunkDocumentWithoutId(filepath, contents, maxChunkSize)) {
        chunkPromises.push(new Promise((resolve) => {
            void (async () => {
                if ((await (0, countTokens_js_1.countTokensAsync)(chunkWithoutId.content)) > maxChunkSize) {
                    // console.debug(
                    //   `Chunk with more than ${maxChunkSize} tokens constructed: `,
                    //   filepath,
                    //   countTokens(chunkWithoutId.content),
                    // );
                    return resolve(undefined);
                }
                resolve({
                    ...chunkWithoutId,
                    digest,
                    index: index++,
                    filepath,
                });
            })();
        }));
    }
    for await (const chunk of chunkPromises) {
        if (!chunk) {
            continue;
        }
        yield chunk;
    }
}
function shouldChunk(fileUri, contents) {
    if (contents.length > 1000000) {
        // if a file has more than 1m characters then skip it
        return false;
    }
    if (contents.length === 0) {
        return false;
    }
    const baseName = (0, uri_js_1.getUriPathBasename)(fileUri);
    return baseName.includes(".");
}
//# sourceMappingURL=chunk.js.map