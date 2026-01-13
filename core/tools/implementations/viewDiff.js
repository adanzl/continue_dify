"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewDiffImpl = exports.DEFAULT_GIT_DIFF_LINE_LIMIT = void 0;
const gitDiffCache_1 = require("../../autocomplete/snippets/gitDiffCache");
exports.DEFAULT_GIT_DIFF_LINE_LIMIT = 5000;
const viewDiffImpl = async (args, extras) => {
    const diffs = await (0, gitDiffCache_1.getDiffsFromCache)(extras.ide); // const diffs = await extras.ide.getDiff(true);
    // TODO includeUnstaged should be an option
    const combinedDiff = diffs.join("\n");
    if (!combinedDiff.trim()) {
        return [
            {
                name: "Diff",
                description: "current Git diff",
                content: "The current diff is empty",
            },
        ];
    }
    const diffLines = combinedDiff.split("\n");
    let truncated = false;
    let processedDiff = combinedDiff;
    if (diffLines.length > exports.DEFAULT_GIT_DIFF_LINE_LIMIT) {
        truncated = true;
        processedDiff = diffLines.slice(0, exports.DEFAULT_GIT_DIFF_LINE_LIMIT).join("\n");
    }
    const contextItems = [
        {
            name: "Diff",
            description: "The current git diff",
            content: processedDiff,
        },
    ];
    if (truncated) {
        contextItems.push({
            name: "Truncation warning",
            description: "",
            content: `The git diff was truncated because it exceeded ${exports.DEFAULT_GIT_DIFF_LINE_LIMIT} lines. Consider viewing specific files or focusing on smaller changes.`,
        });
    }
    return contextItems;
};
exports.viewDiffImpl = viewDiffImpl;
//# sourceMappingURL=viewDiff.js.map