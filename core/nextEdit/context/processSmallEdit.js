"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSmallEdit = void 0;
const ignore_js_1 = require("../../indexing/ignore.js");
const NextEditProvider_1 = require("../NextEditProvider");
const aggregateEdits_1 = require("./aggregateEdits");
const diffFormatting_1 = require("./diffFormatting");
const processNextEditData_1 = require("./processNextEditData");
const processSmallEdit = async (beforeAfterdiff, cursorPosBeforeEdit, cursorPosAfterPrevEdit, configHandler, getDefsFromLspFunction, ide) => {
    // Get the current context data from the most recent message
    const currentData = aggregateEdits_1.EditAggregator.getInstance()
        .latestContextData || {
        configHandler: configHandler,
        getDefsFromLspFunction: getDefsFromLspFunction,
        recentlyEditedRanges: [],
        recentlyVisitedRanges: [],
    };
    if (!(0, ignore_js_1.isSecurityConcern)(beforeAfterdiff.filePath)) {
        NextEditProvider_1.NextEditProvider.getInstance().addDiffToContext((0, diffFormatting_1.createDiff)({
            beforeContent: beforeAfterdiff.beforeContent,
            afterContent: beforeAfterdiff.afterContent,
            filePath: beforeAfterdiff.filePath,
            diffType: diffFormatting_1.DiffFormatType.Unified,
            contextLines: 3, // NOTE: This can change depending on experiments!
            workspaceDir: currentData.workspaceDir,
        }));
    }
    void (0, processNextEditData_1.processNextEditData)({
        filePath: beforeAfterdiff.filePath,
        beforeContent: beforeAfterdiff.beforeContent,
        afterContent: beforeAfterdiff.afterContent,
        cursorPosBeforeEdit: cursorPosBeforeEdit,
        cursorPosAfterPrevEdit: cursorPosAfterPrevEdit,
        ide: ide,
        configHandler: currentData.configHandler,
        getDefinitionsFromLsp: currentData.getDefsFromLspFunction,
        recentlyEditedRanges: currentData.recentlyEditedRanges,
        recentlyVisitedRanges: currentData.recentlyVisitedRanges,
        workspaceDir: currentData.workspaceDir,
    });
};
exports.processSmallEdit = processSmallEdit;
//# sourceMappingURL=processSmallEdit.js.map