"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlPageToArticleWithChunks = htmlPageToArticleWithChunks;
exports.markdownPageToArticleWithChunks = markdownPageToArticleWithChunks;
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
const markdown_1 = require("../chunk/markdown");
function breakdownArticleComponent(url, article, subpath, max_chunk_size) {
    const chunks = [];
    const lines = article.body.split("\n");
    let startLine = 0;
    let endLine = 0;
    let content = "";
    let index = 0;
    const fullUrl = new URL(`${subpath}#${(0, markdown_1.cleanFragment)(article.title)}`, url).toString();
    const createChunk = (chunkContent, chunkStartLine, chunkEndLine) => {
        chunks.push({
            content: chunkContent.trim(),
            startLine: chunkStartLine,
            endLine: chunkEndLine,
            otherMetadata: {
                title: (0, markdown_1.cleanHeader)(article.title),
            },
            index: index++,
            filepath: fullUrl,
            digest: fullUrl,
        });
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Handle oversized lines by splitting them
        if (line.length > max_chunk_size) {
            // First push any accumulated content
            if (content.trim().length > 0) {
                createChunk(content, startLine, endLine);
                content = "";
            }
            // Split the long line into chunks
            let remainingLine = line;
            let subLineStart = i;
            while (remainingLine.length > 0) {
                const chunk = remainingLine.slice(0, max_chunk_size);
                createChunk(chunk, subLineStart, i);
                remainingLine = remainingLine.slice(max_chunk_size);
            }
            startLine = i + 1;
            continue;
        }
        // Normal line handling
        if (content.length + line.length + 1 <= max_chunk_size) {
            content += `${line}\n`;
            endLine = i;
        }
        else {
            if (content.trim().length > 0) {
                createChunk(content, startLine, endLine);
            }
            content = `${line}\n`;
            startLine = i;
            endLine = i;
        }
    }
    // Push the last chunk
    if (content.trim().length > 0) {
        createChunk(content, startLine, endLine);
    }
    return chunks.filter((c) => c.content.trim().length > 20);
}
function chunkArticle(article, maxChunkSize) {
    const chunks = [];
    for (const component of article.article_components) {
        const articleChunks = breakdownArticleComponent(article.url, component, article.subpath, maxChunkSize);
        chunks.push(...articleChunks);
    }
    return chunks;
}
async function htmlPageToArticleWithChunks(page, maxChunkSize) {
    try {
        const html = page.content;
        const subpath = page.path;
        const url = page.url;
        const dom = new jsdom_1.JSDOM(html);
        const reader = new readability_1.Readability(dom.window.document);
        const readability = reader.parse();
        if (!readability) {
            console.error("Docs indexing: Error getting readability for URL", url);
            return undefined;
        }
        const title = readability.title || subpath;
        const titles = Array.from(dom.window.document.querySelectorAll("h2"));
        const article_components = titles.length > 0
            ? titles.map((titleElement) => {
                const title = titleElement.textContent || "";
                let body = "";
                let nextSibling = titleElement.nextElementSibling;
                while (nextSibling && nextSibling.tagName !== "H2") {
                    body += nextSibling.textContent || "";
                    nextSibling = nextSibling.nextElementSibling;
                }
                return { title, body };
            })
            : [
                {
                    title: title,
                    body: readability.textContent,
                },
            ];
        const article = {
            url,
            subpath,
            title: title,
            article_components,
        };
        return {
            article,
            chunks: chunkArticle(article, maxChunkSize),
        };
    }
    catch (err) {
        console.error("Error converting URL to article components", err);
    }
}
async function markdownPageToArticleWithChunks(page, maxChunkSize) {
    try {
        let index = 0;
        const chunks = [];
        const chunker = (0, markdown_1.markdownChunker)(page.content, maxChunkSize, 1);
        for await (const chunk of chunker) {
            const fullUrl = new URL(page.url);
            fullUrl.hash = `#${(0, markdown_1.cleanFragment)(chunk.otherMetadata?.title)}`;
            chunks.push({
                ...chunk,
                index,
                filepath: fullUrl.toString(),
                digest: fullUrl.toString(),
            });
            index++;
        }
        return {
            article: {
                url: page.url,
                subpath: page.path,
                article_components: [], // TODO: markdown chunker just skips this for now since not used outside, only for html chunker
                title: chunks[0]?.otherMetadata?.title || page.path,
            },
            chunks,
        };
    }
    catch (err) {
        console.error(`Docs indexing: failed to chunk markdown from ${page.url}`);
    }
}
//# sourceMappingURL=article.js.map