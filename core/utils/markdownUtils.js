"use strict";
/**
 * Utility functions for working with markdown files and code blocks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownBlockStateTracker = void 0;
exports.headerIsMarkdown = headerIsMarkdown;
exports.isMarkdownFile = isMarkdownFile;
exports.collectAllLines = collectAllLines;
/**
 * Determines if a code block header indicates markdown content
 */
function headerIsMarkdown(header) {
    return (header === "md" ||
        header === "markdown" ||
        header === "gfm" ||
        header === "github-markdown" ||
        header.includes(" md") ||
        header.includes(" markdown") ||
        header.includes(" gfm") ||
        header.includes(" github-markdown") ||
        header.split(" ")[0]?.split(".").pop() === "md" ||
        header.split(" ")[0]?.split(".").pop() === "markdown" ||
        header.split(" ")[0]?.split(".").pop() === "gfm");
}
/**
 * Determines if a file is a markdown file based on its filepath.
 */
function isMarkdownFile(filepath) {
    if (!filepath) {
        return false;
    }
    const ext = filepath.split(".").pop()?.toLowerCase() || "";
    return ["md", "markdown", "gfm"].includes(ext);
}
/**
 * State tracker for markdown block analysis to avoid recomputing on each call.
 * Optimized to handle nested markdown code blocks.
 */
class MarkdownBlockStateTracker {
    constructor(allLines) {
        this.markdownNestCount = 0;
        this.lastProcessedIndex = -1;
        this.trimmedLines = allLines.map((l) => l.trim());
        // Pre-compute positions of all bare backtick lines for faster lookup
        this.bareBacktickPositions = [];
        for (let i = 0; i < this.trimmedLines.length; i++) {
            if (this.trimmedLines[i].match(/^`+$/)) {
                this.bareBacktickPositions.push(i);
            }
        }
    }
    /**
     * Determines if we should stop at the given markdown block position.
     * Maintains state across calls to avoid redundant computation.
     */
    shouldStopAtPosition(currentIndex) {
        if (this.trimmedLines[currentIndex] !== "```") {
            return false;
        }
        // Process any lines we haven't seen yet up to currentIndex
        for (let j = this.lastProcessedIndex + 1; j <= currentIndex; j++) {
            const currentLine = this.trimmedLines[j];
            if (this.markdownNestCount > 0) {
                // Inside a markdown block
                if (currentLine.match(/^`+$/)) {
                    // Found bare backticks - check if this is the last one
                    if (j === currentIndex) {
                        const remainingBareBackticks = this.getRemainingBareBackticksAfter(j);
                        if (remainingBareBackticks === 0) {
                            this.markdownNestCount = 0;
                            this.lastProcessedIndex = j;
                            return true;
                        }
                    }
                }
                else if (currentLine.startsWith("```")) {
                    // Going into a nested codeblock
                    this.markdownNestCount++;
                }
            }
            else {
                // Not inside a markdown block yet
                if (currentLine.startsWith("```")) {
                    const header = currentLine.replaceAll("`", "");
                    if (headerIsMarkdown(header)) {
                        this.markdownNestCount = 1;
                    }
                }
            }
        }
        this.lastProcessedIndex = currentIndex;
        return false;
    }
    /**
     * Efficiently determines if there are remaining bare backticks after the given position.
     */
    getRemainingBareBackticksAfter(currentIndex) {
        return this.bareBacktickPositions.filter((pos) => pos > currentIndex)
            .length;
    }
    /**
     * Checks if the line at the given index is a bare backtick line.
     */
    isBareBacktickLine(index) {
        return this.bareBacktickPositions.includes(index);
    }
    /**
     * Gets the trimmed lines array.
     */
    getTrimmedLines() {
        return this.trimmedLines;
    }
}
exports.MarkdownBlockStateTracker = MarkdownBlockStateTracker;
/**
 * Collects all lines from a LineStream into an array for analysis.
 */
async function collectAllLines(stream) {
    const allLines = [];
    for await (const line of stream) {
        allLines.push(line);
    }
    return allLines;
}
//# sourceMappingURL=markdownUtils.js.map