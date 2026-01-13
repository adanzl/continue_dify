"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBeforeAfterDiff = exports.createDiff = exports.DiffFormatType = void 0;
exports.extractMetadataFromUnifiedDiff = extractMetadataFromUnifiedDiff;
const diff_1 = require("diff");
const uri_1 = require("../../util/uri");
var DiffFormatType;
(function (DiffFormatType) {
    DiffFormatType["Unified"] = "unified";
    DiffFormatType["RawBeforeAfter"] = "beforeAfter";
    DiffFormatType["TokenLineDiff"] = "linediff";
})(DiffFormatType || (exports.DiffFormatType = DiffFormatType = {}));
const createDiff = ({ beforeContent, afterContent, filePath, diffType, contextLines, workspaceDir, }) => {
    switch (diffType) {
        case DiffFormatType.Unified:
            return createUnifiedDiff(beforeContent, afterContent, filePath, contextLines, workspaceDir);
        case DiffFormatType.TokenLineDiff:
            return createTokenLineDiff(beforeContent, afterContent, filePath);
    }
    return "";
};
exports.createDiff = createDiff;
const createUnifiedDiff = (beforeContent, afterContent, filePath, contextLines, workspaceDir) => {
    const normalizedBefore = beforeContent.endsWith("\n")
        ? beforeContent
        : beforeContent + "\n";
    const normalizedAfter = afterContent.endsWith("\n")
        ? afterContent
        : afterContent + "\n";
    // Use relative path if workspace directory is provided
    let displayPath = filePath;
    if (workspaceDir && filePath.startsWith(workspaceDir)) {
        displayPath = filePath.slice(workspaceDir.length).replace(/^[\/]/, "");
    }
    else if (workspaceDir) {
        // Fallback to just the basename if we can't determine relative path
        displayPath = (0, uri_1.getUriPathBasename)(filePath);
    }
    const patch = (0, diff_1.createPatch)(displayPath, normalizedBefore, normalizedAfter, undefined, undefined, { context: contextLines });
    return patch;
};
const createBeforeAfterDiff = (beforeContent, afterContent, filePath) => {
    const normalizedBefore = beforeContent.endsWith("\n")
        ? beforeContent
        : beforeContent + "\n";
    const normalizedAfter = afterContent.endsWith("\n")
        ? afterContent
        : afterContent + "\n";
    const result = {
        filePath: filePath,
        beforeContent: normalizedBefore,
        afterContent: normalizedAfter,
    };
    return result;
};
exports.createBeforeAfterDiff = createBeforeAfterDiff;
const createTokenLineDiff = (beforeContent, afterContent, filePath) => {
    // TODO: Implement token line diff
    return "";
};
function extractMetadataFromUnifiedDiff(unifiedDiff) {
    const metadata = {};
    const lines = unifiedDiff.split("\n");
    // Parse the header lines (first two lines)
    if (lines.length >= 2) {
        // Parse original file info (--- line)
        const oldFileMatch = lines[0].match(/^--- (a\/)?(.+?)(?:\t(.+))?$/);
        if (oldFileMatch) {
            metadata.oldFilename = oldFileMatch[2];
            metadata.oldTimestamp = oldFileMatch[3];
            // Check if this is a new file
            if (metadata.oldFilename === "/dev/null") {
                metadata.isNew = true;
            }
        }
        // Parse modified file info (+++ line)
        const newFileMatch = lines[1].match(/^\+\+\+ (b\/)?(.+?)(?:\t(.+))?$/);
        if (newFileMatch) {
            metadata.newFilename = newFileMatch[2];
            metadata.newTimestamp = newFileMatch[3];
            // Check if this file was deleted
            if (metadata.newFilename === "/dev/null") {
                metadata.isDeleted = true;
            }
        }
        // Check if this is a rename (different old and new names)
        if (metadata.oldFilename &&
            metadata.newFilename &&
            metadata.oldFilename !== "/dev/null" &&
            metadata.newFilename !== "/dev/null" &&
            metadata.oldFilename !== metadata.newFilename) {
            metadata.isRename = true;
        }
    }
    // Parse hunk headers and content
    metadata.hunks = [];
    const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:\s(.*))?$/;
    let currentHunk = null;
    let oldLineNumber = 0;
    let newLineNumber = 0;
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        const hunkMatch = line.match(hunkHeaderRegex);
        if (hunkMatch) {
            currentHunk = {
                oldStart: parseInt(hunkMatch[1], 10), // line number where changes start in original file
                oldCount: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1, // number of changed lines in original file, default to 1 if not specified
                newStart: parseInt(hunkMatch[3], 10), // line number where changes start in modified file
                newCount: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1, // number of changed lines in modified file, default to 1 if not specified
                header: hunkMatch[5], // the line starting with @@
                lines: [], // the actual line changes
            };
            oldLineNumber = currentHunk.oldStart;
            newLineNumber = currentHunk.newStart;
            metadata.hunks.push(currentHunk);
        }
        else if (currentHunk &&
            (line.startsWith(" ") || line.startsWith("+") || line.startsWith("-"))) {
            // Process hunk content lines.
            const lineType = line[0];
            const content = line.slice(1);
            if (lineType === " ") {
                // Context line (unchanged).
                currentHunk.lines.push({
                    type: "context",
                    content,
                    oldLineNumber: oldLineNumber++,
                    newLineNumber: newLineNumber++,
                });
            }
            else if (lineType === "+") {
                currentHunk.lines.push({
                    type: "addition",
                    content,
                    newLineNumber: newLineNumber++,
                });
            }
            else if (lineType === "-") {
                currentHunk.lines.push({
                    type: "deletion",
                    content,
                    oldLineNumber: oldLineNumber++,
                });
            }
        }
        // Check for binary file marker
        if (line.includes("Binary files") || line.includes("GIT binary patch")) {
            metadata.isBinary = true;
        }
    }
    return metadata;
}
//# sourceMappingURL=diffFormatting.js.map