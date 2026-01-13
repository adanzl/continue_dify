"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicChunker = basicChunker;
const countTokens_js_1 = require("../../llm/countTokens.js");
async function* basicChunker(contents, maxChunkSize) {
    if (contents.trim().length === 0) {
        return;
    }
    let chunkContent = "";
    let chunkTokens = 0;
    let startLine = 0;
    let currLine = 0;
    const lineTokens = await Promise.all(contents.split("\n").map(async (l) => {
        return {
            line: l,
            tokenCount: await (0, countTokens_js_1.countTokensAsync)(l),
        };
    }));
    for (const lt of lineTokens) {
        if (chunkTokens + lt.tokenCount > maxChunkSize - 5) {
            yield { content: chunkContent, startLine, endLine: currLine - 1 };
            chunkContent = "";
            chunkTokens = 0;
            startLine = currLine;
        }
        if (lt.tokenCount < maxChunkSize) {
            chunkContent += `${lt.line}\n`;
            chunkTokens += lt.tokenCount + 1;
        }
        currLine++;
    }
    yield {
        content: chunkContent,
        startLine,
        endLine: currLine - 1,
    };
}
//# sourceMappingURL=basic.js.map