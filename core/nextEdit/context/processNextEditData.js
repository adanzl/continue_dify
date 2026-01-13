"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processNextEditData = void 0;
const log_1 = require("../../data/log");
const NextEditProvider_1 = require("../NextEditProvider");
const autocompleteContextFetching_1 = require("./autocompleteContextFetching");
const diffFormatting_1 = require("./diffFormatting");
const prevEditLruCache_1 = require("./prevEditLruCache");
const randomNumberBetween = (min, max) => {
    min = Math.ceil(min); // Ensure min is an integer
    max = Math.floor(max); // Ensure max is an integer
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
const processNextEditData = async ({ filePath, beforeContent, afterContent, cursorPosBeforeEdit, cursorPosAfterPrevEdit, ide, configHandler, getDefinitionsFromLsp, recentlyEditedRanges, recentlyVisitedRanges, workspaceDir, modelNameOrInstance, }) => {
    // To switch to the user's autocomplete model, uncomment the following lines
    // const { config } = await configHandler.loadConfig();
    // const autocompleteModel =
    //   (modelNameOrInstance || config?.selectedModelByRole.autocomplete) ??
    //   undefined;
    const modelName = "Codestral";
    const modelProvider = "mistral";
    const maxPromptTokens = randomNumberBetween(500, 12000);
    const autocompleteContext = await (0, autocompleteContextFetching_1.getAutocompleteContext)(filePath, cursorPosBeforeEdit, ide, configHandler, getDefinitionsFromLsp, recentlyEditedRanges, recentlyVisitedRanges, maxPromptTokens, beforeContent, modelName);
    NextEditProvider_1.NextEditProvider.getInstance().addAutocompleteContext(autocompleteContext);
    // console.log(
    //   createDiff(beforeContent, afterContent, filePath, DiffFormatType.Unified),
    // );
    let filenamesAndDiffs = [];
    const timestamp = Date.now();
    let prevEdits = (0, prevEditLruCache_1.getPrevEditsDescending)(); // edits from most to least recent
    if (prevEdits.length > 0) {
        // if last edit was 10+ minutes ago or the workspace changed, forget previous edits
        if (timestamp - prevEdits[0].timestamp >= 1000 * 60 * 10 ||
            workspaceDir !== prevEdits[0].workspaceUri) {
            prevEditLruCache_1.prevEditLruCache.clear();
            prevEdits = [];
        }
        // extract filenames and diffs for logging
        filenamesAndDiffs = prevEdits.map((edit) => ({
            // filename relative to workspace dir
            filename: edit.fileUri
                .replace(edit.workspaceUri, "")
                .replace(/^[/\\]/, ""),
            // diff without the first 4 lines (the file header)
            diff: edit.unidiff.split("\n").slice(4).join("\n"),
        }));
    }
    if (filenamesAndDiffs.length > 0) {
        // if there are previous edits, log
        void log_1.DataLogger.getInstance().logDevData({
            name: "nextEditWithHistory",
            data: {
                previousEdits: filenamesAndDiffs,
                fileURI: filePath,
                workspaceDirURI: workspaceDir,
                beforeContent,
                afterContent,
                beforeCursorPos: cursorPosBeforeEdit,
                afterCursorPos: cursorPosAfterPrevEdit,
                context: autocompleteContext,
                modelProvider,
                modelName,
                modelTitle: modelName,
            },
        });
    }
    // add current edit to history
    const thisEdit = {
        unidiff: (0, diffFormatting_1.createDiff)({
            beforeContent: beforeContent,
            afterContent: afterContent,
            filePath: filePath,
            diffType: diffFormatting_1.DiffFormatType.Unified,
            contextLines: 25, // storing many context lines for downstream trimming
            workspaceDir: workspaceDir,
        }),
        fileUri: filePath,
        workspaceUri: workspaceDir,
        timestamp: timestamp,
    };
    (0, prevEditLruCache_1.setPrevEdit)(thisEdit);
};
exports.processNextEditData = processNextEditData;
//# sourceMappingURL=processNextEditData.js.map