"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseNextEditModelProvider = void 0;
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const myers_js_1 = require("../../diff/myers.js");
const countTokens_js_1 = require("../../llm/countTokens.js");
const diff_js_1 = require("../diff/diff.js");
const NextEditPrefetchQueue_js_1 = require("../NextEditPrefetchQueue.js");
const utils_js_1 = require("../utils.js");
/**
 * This class is used as an abstract base class for model-specific providers.
 * This and its children are responsible for pre/post processing of prompts and outcomes.
 * Different next edit models have very different requirements.
 */
class BaseNextEditModelProvider {
    constructor(modelName) {
        this.modelName = modelName;
    }
    // Methods that can be used as default fallback.
    async handlePartialFileDiff(params) {
        const { helper, editableRegionStartLine, editableRegionEndLine, startTime, llm, nextCompletion, promptMetadata, ide, profileType, } = params;
        const oldEditRangeSlice = helper.fileContents
            .split("\n")
            .slice(editableRegionStartLine, editableRegionEndLine + 1)
            .join("\n");
        const finalCursorPos = (0, diff_js_1.calculateFinalCursorPosition)(helper.pos, editableRegionStartLine, oldEditRangeSlice, nextCompletion);
        const outcome = await this.createNextEditOutcome({
            helper,
            startTime,
            llm,
            promptContent: promptMetadata.prompt.content,
            completion: nextCompletion,
            finalCursorPosition: finalCursorPos,
            editableRegionStartLine,
            editableRegionEndLine,
            userEdits: promptMetadata.userEdits,
            userExcerpts: promptMetadata.userExcerpts,
            originalEditableRange: oldEditRangeSlice,
            diffLines: [],
            ide,
            profileType,
        });
        return outcome;
    }
    async handleFullFileDiff(params) {
        const { helper, editableRegionStartLine, editableRegionEndLine, startTime, llm, nextCompletion, promptMetadata, ide, profileType, } = params;
        const fileSlice = helper.fileLines
            .slice(editableRegionStartLine, editableRegionEndLine + 1)
            .join("\n");
        const diffLines = (0, myers_js_1.myersDiff)(fileSlice, nextCompletion);
        const diffGroups = (0, diff_js_1.groupDiffLines)(diffLines, editableRegionStartLine, 5).filter((group) => !(0, utils_js_1.isWhitespaceOnlyDeletion)(group.lines));
        const currentLine = helper.pos.line;
        const prefetchQueue = NextEditPrefetchQueue_js_1.PrefetchQueue.getInstance();
        const cursorLocalDiffGroup = await this.processDiffGroups({
            diffGroups,
            currentLine,
            helper,
            startTime,
            llm,
            prefetchQueue,
            promptMetadata,
            ide,
            profileType,
        });
        if (cursorLocalDiffGroup) {
            return await this.createOutcomeFromDiffGroup({
                diffGroup: cursorLocalDiffGroup,
                helper,
                startTime,
                llm,
                completionId: helper.input.completionId,
                isCurrentCursorGroup: true,
                promptMetadata,
                ide,
                profileType,
            });
        }
        return undefined;
    }
    /**
     * Process diff groups and find the one containing the cursor.
     */
    async processDiffGroups(params) {
        const { diffGroups, currentLine, helper, startTime, llm, prefetchQueue, promptMetadata, ide, profileType, } = params;
        let cursorGroup;
        for (const group of diffGroups) {
            if (currentLine >= group.startLine && currentLine <= group.endLine) {
                cursorGroup = group;
            }
            else {
                await this.addDiffGroupToPrefetchQueue({
                    group,
                    helper,
                    startTime,
                    llm,
                    prefetchQueue,
                    promptMetadata,
                    ide,
                    profileType,
                });
            }
        }
        return cursorGroup;
    }
    async addDiffGroupToPrefetchQueue(params) {
        const { group, helper, startTime, llm, prefetchQueue, promptMetadata, ide, profileType, } = params;
        // Extract lines that are not old.
        const groupContent = group.lines
            .filter((l) => l.type !== "old")
            .map((l) => l.line)
            .join("\n");
        const rangeInFile = {
            filepath: helper.filepath,
            range: {
                start: { line: group.startLine, character: 0 },
                end: {
                    line: group.endLine,
                    character: group.lines[group.lines.length - 1].line.length,
                },
            },
        };
        // Extract lines that are not new.
        const originalContent = group.lines
            .filter((l) => l.type !== "new")
            .map((l) => l.line)
            .join("\n");
        const groupOutcome = await this.createNextEditOutcome({
            helper,
            startTime,
            llm,
            promptContent: promptMetadata.prompt.content,
            completion: groupContent,
            finalCursorPosition: {
                line: group.endLine,
                character: group.lines[group.lines.length - 1].line.length,
            },
            editableRegionStartLine: group.startLine,
            editableRegionEndLine: group.endLine,
            userEdits: promptMetadata.userEdits,
            userExcerpts: promptMetadata.userExcerpts,
            originalEditableRange: originalContent,
            cursorPosition: { line: group.startLine, character: 0 },
            completionId: (0, uuid_1.v4)(), // Generate a new ID for this prefetched item.
            diffLines: group.lines,
            ide,
            profileType,
        });
        prefetchQueue.enqueueProcessed({
            location: rangeInFile,
            outcome: groupOutcome,
        });
    }
    async createOutcomeFromDiffGroup(params) {
        const { diffGroup, helper, startTime, llm, completionId, isCurrentCursorGroup, promptMetadata, ide, profileType, } = params;
        const groupContent = diffGroup.lines
            .filter((l) => l.type !== "old")
            .map((l) => l.line)
            .join("\n");
        const originalContent = diffGroup.lines
            .filter((l) => l.type !== "new")
            .map((l) => l.line)
            .join("\n");
        const cursorPos = isCurrentCursorGroup
            ? helper.pos
            : { line: diffGroup.startLine, character: 0 };
        const finalCursorPos = (0, diff_js_1.calculateFinalCursorPosition)(cursorPos, diffGroup.startLine, originalContent, groupContent);
        const outcomeNext = await this.createNextEditOutcome({
            helper,
            startTime,
            llm,
            promptContent: promptMetadata.prompt.content,
            completion: groupContent,
            finalCursorPosition: finalCursorPos,
            editableRegionStartLine: diffGroup.startLine,
            editableRegionEndLine: diffGroup.endLine,
            userEdits: promptMetadata.userEdits,
            userExcerpts: promptMetadata.userExcerpts,
            originalEditableRange: originalContent,
            cursorPosition: cursorPos,
            completionId,
            diffLines: diffGroup.lines,
            ide,
            profileType,
        });
        return outcomeNext;
    }
    async createNextEditOutcome(outcomeCtx) {
        return {
            elapsed: Date.now() - outcomeCtx.startTime,
            modelProvider: outcomeCtx.llm.underlyingProviderName,
            modelName: outcomeCtx.llm.model,
            completionOptions: null,
            completionId: outcomeCtx.completionId || outcomeCtx.helper.input.completionId,
            gitRepo: await outcomeCtx.ide.getRepoName(outcomeCtx.helper.filepath),
            uniqueId: await outcomeCtx.ide.getUniqueId(),
            requestId: outcomeCtx.llm.lastRequestId,
            timestamp: Date.now(),
            fileUri: outcomeCtx.helper.filepath,
            workspaceDirUri: outcomeCtx.helper.workspaceUris[0] ??
                path.dirname(outcomeCtx.helper.filepath),
            prompt: outcomeCtx.promptContent,
            userEdits: outcomeCtx.userEdits ?? "",
            userExcerpts: outcomeCtx.userExcerpts ?? "",
            originalEditableRange: outcomeCtx.originalEditableRange ?? "",
            completion: outcomeCtx.completion,
            cursorPosition: outcomeCtx.cursorPosition || outcomeCtx.helper.pos,
            finalCursorPosition: outcomeCtx.finalCursorPosition,
            editableRegionStartLine: outcomeCtx.editableRegionStartLine,
            editableRegionEndLine: outcomeCtx.editableRegionEndLine,
            diffLines: outcomeCtx.diffLines,
            profileType: outcomeCtx.profileType,
            ...outcomeCtx.helper.options,
        };
    }
    // Shared utility for calculating editable regions.
    calculateOptimalEditableRegion(helper, maxTokens = 512, heuristic = "tokenizer") {
        const cursorLine = helper.pos.line;
        const fileLines = helper.fileLines;
        let editableRegionStartLine = cursorLine;
        let editableRegionEndLine = cursorLine;
        let currentContent = fileLines[cursorLine];
        let totalTokens = heuristic === "tokenizer"
            ? (0, countTokens_js_1.countTokens)(currentContent, helper.modelName)
            : Math.ceil(currentContent.length / 4);
        let addingAbove = true;
        while (totalTokens < maxTokens) {
            let addedLine = false;
            if (addingAbove) {
                if (editableRegionStartLine > 0) {
                    editableRegionStartLine--;
                    const lineContent = fileLines[editableRegionStartLine];
                    const lineTokens = heuristic === "tokenizer"
                        ? (0, countTokens_js_1.countTokens)(lineContent, helper.modelName)
                        : Math.ceil(lineContent.length / 4);
                    totalTokens += lineTokens;
                    addedLine = true;
                }
            }
            else {
                if (editableRegionEndLine < fileLines.length - 1) {
                    editableRegionEndLine++;
                    const lineContent = fileLines[editableRegionEndLine];
                    const lineTokens = heuristic === "tokenizer"
                        ? (0, countTokens_js_1.countTokens)(lineContent, helper.modelName)
                        : Math.ceil(lineContent.length / 4);
                    totalTokens += lineTokens;
                    addedLine = true;
                }
            }
            if (!addedLine) {
                if (editableRegionStartLine === 0 &&
                    editableRegionEndLine === fileLines.length - 1) {
                    break;
                }
                addingAbove = !addingAbove;
                continue;
            }
            if (totalTokens > maxTokens) {
                if (addingAbove) {
                    editableRegionStartLine++;
                }
                else {
                    editableRegionEndLine--;
                }
                break;
            }
            addingAbove = !addingAbove;
        }
        return {
            editableRegionStartLine,
            editableRegionEndLine,
        };
    }
    // Optional methods with defaults.
    shouldInjectUniqueToken() {
        return false;
    }
    getUniqueToken() {
        return null;
    }
}
exports.BaseNextEditModelProvider = BaseNextEditModelProvider;
//# sourceMappingURL=BaseNextEditProvider.js.map