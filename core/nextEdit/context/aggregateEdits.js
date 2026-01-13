"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditAggregator = void 0;
const diffFormatting_1 = require("./diffFormatting");
class EditAggregator {
    static getInstance(config, onComparisonFinalized) {
        // Create instance if it doesn't exist
        if (!EditAggregator._instance) {
            EditAggregator._instance = new EditAggregator(config, onComparisonFinalized);
        }
        // Update instance if new parameters are provided
        else if (config || onComparisonFinalized) {
            if (config) {
                EditAggregator._instance.config = {
                    deltaT: config.deltaT ?? EditAggregator._instance.config.deltaT,
                    deltaL: config.deltaL ?? EditAggregator._instance.config.deltaL,
                    maxEdits: config.maxEdits ?? EditAggregator._instance.config.maxEdits,
                    maxDuration: config.maxDuration ?? EditAggregator._instance.config.maxDuration,
                    contextSize: config.contextSize ?? EditAggregator._instance.config.contextSize,
                    contextLines: config.contextLines ?? EditAggregator._instance.config.contextLines,
                };
            }
            if (onComparisonFinalized) {
                EditAggregator._instance.onComparisonFinalized = onComparisonFinalized;
            }
        }
        return EditAggregator._instance;
    }
    constructor(config = {}, onComparisonFinalized = () => { }) {
        this.fileStates = new Map();
        this.lastProcessedFilePath = null;
        this.config = {
            deltaT: config.deltaT ?? 1.0,
            deltaL: config.deltaL ?? 5,
            maxEdits: config.maxEdits ?? 500,
            maxDuration: config.maxDuration ?? 100.0,
            contextSize: config.contextSize ?? 5,
            contextLines: config.contextLines ?? 3,
        };
        this.onComparisonFinalized = onComparisonFinalized;
        this.previousEditFinalCursorPosition = { line: 0, character: 0 };
    }
    async processEdit(edit, timestamp = Date.now()) {
        const filePath = edit.filepath;
        // If we're switching to a different file, finalize all clusters from the previous file
        if (this.lastProcessedFilePath && this.lastProcessedFilePath !== filePath) {
            await this.finalizeClustersForFile(this.lastProcessedFilePath);
        }
        // Update the last processed file path
        this.lastProcessedFilePath = filePath;
        if (!this.fileStates.has(filePath)) {
            this.fileStates.set(filePath, {
                activeClusters: [],
                currentContent: edit.fileContents, // Post-edit content (will be updated correctly by _processEditInternal)
                priorComparisons: [],
                processingQueue: [],
                isProcessing: false,
            });
        }
        const fileState = this.fileStates.get(filePath);
        const task = async () => {
            await this._processEditInternal(edit, timestamp, fileState);
        };
        fileState.processingQueue.push(task);
        if (!fileState.isProcessing) {
            void this._processQueue(filePath);
        }
    }
    async _processQueue(filePath) {
        const fileState = this.fileStates.get(filePath);
        if (!fileState)
            return;
        fileState.isProcessing = true;
        // Process chunks of (5) edits instead of one at a time
        while (fileState.processingQueue.length > 0) {
            const tasks = fileState.processingQueue.splice(0, 5);
            if (tasks.length > 0) {
                try {
                    await Promise.all(tasks.map((task) => task()));
                }
                catch (error) {
                    console.error(`Error processing edits in ${filePath}:`, error);
                }
                // Yield to the event loop to prevent blocking
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        fileState.isProcessing = false;
    }
    async _processEditInternal(edit, timestamp, fileState) {
        const filePath = edit.filepath;
        const editLine = edit.range.start.line;
        const currentFileLines = fileState.currentContent.split("\n");
        const clustersToFinalize = this.identifyClustersToFinalize(fileState, edit, timestamp, false);
        for (const cluster of clustersToFinalize) {
            await this.finalizeCluster(filePath, cluster, fileState);
        }
        let suitableCluster = this.findSuitableCluster(fileState, editLine, timestamp);
        // Check if adding this edit would exceed deltaL lines for the cluster
        if (suitableCluster) {
            const potentialMinLine = Math.min(suitableCluster.currentRange.minLine, Math.max(0, editLine - this.config.contextLines));
            const potentialMaxLine = Math.max(suitableCluster.currentRange.maxLine, Math.min(currentFileLines.length - 1, editLine + this.config.contextLines));
            const potentialLineSpan = potentialMaxLine - potentialMinLine + 1;
            if (potentialLineSpan > this.config.deltaL * 2) {
                // Auto-finalize the current cluster before creating a new one
                await this.finalizeCluster(filePath, suitableCluster, fileState);
                suitableCluster = null;
            }
        }
        // initialize a cluster
        if (!suitableCluster) {
            // Use fileContentsBefore if available (tracked by VS Code extension),
            // otherwise fall back to current content
            const beforeState = edit.fileContentsBefore ?? fileState.currentContent;
            suitableCluster = {
                beforeState,
                startRange: {
                    minLine: Math.max(0, editLine - this.config.contextLines),
                    maxLine: Math.min(currentFileLines.length - 1, editLine + this.config.contextLines),
                },
                currentRange: {
                    minLine: Math.max(0, editLine - this.config.contextLines),
                    maxLine: Math.min(currentFileLines.length - 1, editLine + this.config.contextLines),
                },
                edits: [],
                firstTimestamp: timestamp,
                lastTimestamp: timestamp,
                lastLine: editLine,
                firstEditBeforeCursor: edit.beforeCursorPos,
                lastEditAfterCursor: edit.afterCursorPos,
            };
            fileState.activeClusters.push(suitableCluster);
        }
        suitableCluster.edits.push(edit);
        suitableCluster.lastTimestamp = timestamp;
        suitableCluster.lastLine = editLine;
        suitableCluster.lastEditAfterCursor = edit.afterCursorPos;
        const isWhitespaceOnly = this.isWhitespaceOnlyEdit(edit, fileState.currentContent);
        if (!isWhitespaceOnly) {
            suitableCluster.currentRange.minLine = Math.min(suitableCluster.currentRange.minLine, Math.max(0, editLine - this.config.contextLines));
            suitableCluster.currentRange.maxLine = Math.max(suitableCluster.currentRange.maxLine, Math.min(currentFileLines.length - 1, editLine + this.config.contextLines));
        }
        fileState.currentContent = edit.fileContents;
        const isStructuralEdit = edit.editText.includes("\n") ||
            edit.range.start.line !== edit.range.end.line;
        if (isStructuralEdit) {
            const additionalClustersToFinalize = fileState.activeClusters.filter((c) => c !== suitableCluster && this.clustersOverlap(c, suitableCluster));
            for (const cluster of additionalClustersToFinalize) {
                await this.finalizeCluster(filePath, cluster, fileState);
            }
        }
    }
    isWhitespaceOnlyEdit(edit, currentContent) {
        const lines = currentContent.split("\n");
        const line = edit.range.start.line;
        if (line >= lines.length)
            return false;
        if (edit.range.start.line === edit.range.end.line) {
            const beforeEdit = lines[line];
            const afterEdit = beforeEdit.substring(0, edit.range.start.character) +
                edit.editText +
                beforeEdit.substring(edit.range.end.character);
            return beforeEdit.trim() === afterEdit.trim();
        }
        return false;
    }
    clustersOverlap(cluster1, cluster2) {
        return (cluster1.currentRange.minLine <=
            cluster2.currentRange.maxLine + this.config.deltaL &&
            cluster1.currentRange.maxLine >=
                cluster2.currentRange.minLine - this.config.deltaL);
    }
    async processEdits(edits) {
        const timestamp = Date.now();
        // Only process the last edit during rapid typing
        if (this.getProcessingQueueSize() > 50) {
            if (edits.length > 0) {
                await this.processEdit(edits[edits.length - 1], timestamp);
            }
            return;
        }
        for (const edit of edits) {
            await this.processEdit(edit, timestamp);
        }
    }
    /**
     * Finalizes all clusters for a specific file
     */
    async finalizeClustersForFile(filePath) {
        const fileState = this.fileStates.get(filePath);
        if (!fileState)
            return;
        // Create a copy of the clusters to finalize to avoid modifying array during iteration
        const clustersToFinalize = [...fileState.activeClusters];
        for (const cluster of clustersToFinalize) {
            await this.finalizeCluster(filePath, cluster, fileState);
        }
    }
    async finalizeAllClusters() {
        const filePromises = [];
        this.fileStates.forEach((fileState, filePath) => {
            const filePromise = this.finalizeClustersForFile(filePath);
            filePromises.push(filePromise);
        });
        await Promise.all(filePromises);
    }
    findSuitableCluster(fileState, editLine, timestamp) {
        const activeClusters = [...fileState.activeClusters];
        for (const cluster of activeClusters) {
            // If we're outside the line range but within the time window,
            // we should finalize the current cluster
            const isOutsideLineRange = editLine < cluster.currentRange.minLine - this.config.deltaL ||
                editLine > cluster.currentRange.maxLine + this.config.deltaL;
            const isWithinTimeWindow = (timestamp - cluster.lastTimestamp) / 1000 <= this.config.deltaT;
            // If user quickly jumped far away, finalize this cluster before continuing
            if (isOutsideLineRange && isWithinTimeWindow) {
                void this.finalizeCluster(cluster.edits[0].filepath, cluster, fileState);
            }
        }
        // Now look for a suitable cluster for the new edit
        for (const cluster of fileState.activeClusters) {
            const isOnSameLine = editLine === cluster.lastLine;
            const isWithinTimeWindow = (timestamp - cluster.lastTimestamp) / 1000 <= this.config.deltaT;
            const isWithinLineRange = editLine >= cluster.currentRange.minLine - this.config.deltaL &&
                editLine <= cluster.currentRange.maxLine + this.config.deltaL;
            const isWithinEditLimit = cluster.edits.length < this.config.maxEdits;
            const isWithinDurationLimit = (timestamp - cluster.firstTimestamp) / 1000 <= this.config.maxDuration;
            if ((isOnSameLine || (isWithinTimeWindow && isWithinLineRange)) &&
                isWithinEditLimit &&
                isWithinDurationLimit) {
                return cluster;
            }
        }
        return null;
    }
    identifyClustersToFinalize(fileState, edit, timestamp, isStructuralEdit) {
        const clustersToFinalize = [];
        const editLine = edit.range.start.line;
        fileState.activeClusters.forEach((cluster) => {
            const timeSinceLastEdit = (timestamp - cluster.lastTimestamp) / 1000;
            const isOnDifferentLineByNumber = cluster.lastLine !== editLine;
            const isOnDifferentLineByNewline = edit.editText.includes("\n");
            // Use different time thresholds for different types of line change detection
            const shouldFinalizeByLineNumber = isOnDifferentLineByNumber && timeSinceLastEdit > this.config.deltaT;
            const shouldFinalizeByNewline = isOnDifferentLineByNewline &&
                timeSinceLastEdit > this.config.deltaT * 1.5;
            // Finalize if we moved to a different line AND the time gap exceeds the respective threshold
            const shouldFinalizeByTime = shouldFinalizeByLineNumber || shouldFinalizeByNewline;
            const shouldFinalizeByCount = cluster.edits.length >= this.config.maxEdits;
            const shouldFinalizeByDuration = (timestamp - cluster.firstTimestamp) / 1000 > this.config.maxDuration;
            // For structural edits, use the combined line detection
            const isOnDifferentLine = isOnDifferentLineByNumber || isOnDifferentLineByNewline;
            const shouldFinalizeByStructuralEdit = isStructuralEdit && isOnDifferentLine;
            if (shouldFinalizeByTime ||
                shouldFinalizeByCount ||
                shouldFinalizeByDuration ||
                shouldFinalizeByStructuralEdit) {
                clustersToFinalize.push(cluster);
            }
        });
        return clustersToFinalize;
    }
    async finalizeCluster(filePath, cluster, fileState) {
        const beforeContent = cluster.beforeState;
        const afterContent = fileState.currentContent;
        // Skip whitespace-only diffs
        const isWhitespaceOnlyDiff = beforeContent.replace(/\s+/g, "") === afterContent.replace(/\s+/g, "");
        if (isWhitespaceOnlyDiff) {
            fileState.activeClusters = fileState.activeClusters.filter((c) => c !== cluster);
            return;
        }
        const diff = (0, diffFormatting_1.createDiff)({
            beforeContent: beforeContent,
            afterContent: afterContent,
            filePath: filePath,
            diffType: diffFormatting_1.DiffFormatType.Unified,
            contextLines: 3,
        }); // Used for checks, not for final output
        // Skip diffs with too many changed lines
        const changedLineCount = this.countChangedLines(diff);
        if (changedLineCount > this.config.deltaL * 2) {
            fileState.activeClusters = fileState.activeClusters.filter((c) => c !== cluster);
            return;
        }
        fileState.priorComparisons.push(diff);
        if (fileState.priorComparisons.length > this.config.contextSize) {
            fileState.priorComparisons.shift();
        }
        fileState.activeClusters = fileState.activeClusters.filter((c) => c !== cluster);
        // Give format-agnostic diff to the callback
        const fullFileVersionsDiff = (0, diffFormatting_1.createBeforeAfterDiff)(beforeContent, afterContent, filePath);
        // Store this cluster's final cursor position for future reference
        this.previousEditFinalCursorPosition = cluster.lastEditAfterCursor;
        this.onComparisonFinalized(fullFileVersionsDiff, cluster.firstEditBeforeCursor, this.previousEditFinalCursorPosition);
    }
    countChangedLines(diff) {
        let count = 0;
        let addedLines = new Set();
        let removedLines = new Set();
        // Parse the diff lines
        const lines = diff.split("\n");
        for (const line of lines) {
            if (line.startsWith("+++ ") ||
                line.startsWith("--- ") ||
                line.startsWith("@@")) {
                continue; // Skip header lines
            }
            if (line.startsWith("+")) {
                addedLines.add(count);
                count++;
            }
            else if (line.startsWith("-")) {
                removedLines.add(count);
                count++;
            }
        }
        return Math.max(addedLines.size, removedLines.size);
    }
    getActiveClusterCount() {
        let count = 0;
        this.fileStates.forEach((fileState) => {
            count += fileState.activeClusters.length;
        });
        return count;
    }
    getProcessingQueueSize() {
        let count = 0;
        this.fileStates.forEach((fileState) => {
            count += fileState.processingQueue.length;
        });
        return count;
    }
    resetState() {
        this.fileStates.clear();
        this.lastProcessedFilePath = null;
    }
    /**
     * Gets the in-progress diff for a file by comparing the earliest active cluster's
     * beforeState with the current file content.
     * This captures edits that haven't been finalized yet.
     *
     * @param filePath The file path to get the in-progress diff for
     * @returns The unified diff string if there are active clusters, or null otherwise
     */
    getInProgressDiff(filePath) {
        const fileState = this.fileStates.get(filePath);
        if (!fileState || fileState.activeClusters.length === 0) {
            return null;
        }
        // Get the earliest active cluster (first edit that started this batch of typing)
        const earliestCluster = fileState.activeClusters.reduce((earliest, cluster) => cluster.firstTimestamp < earliest.firstTimestamp ? cluster : earliest);
        const beforeContent = earliestCluster.beforeState;
        const afterContent = fileState.currentContent;
        // Skip if the content is the same
        if (beforeContent === afterContent) {
            return null;
        }
        // Skip whitespace-only diffs
        if (beforeContent.replace(/\s+/g, "") === afterContent.replace(/\s+/g, "")) {
            return null;
        }
        // Get workspaceDir from the first edit in the cluster (for consistent path formatting)
        const workspaceDir = earliestCluster.edits[0]?.workspaceDir;
        return (0, diffFormatting_1.createDiff)({
            beforeContent,
            afterContent,
            filePath,
            diffType: diffFormatting_1.DiffFormatType.Unified,
            contextLines: 3,
            workspaceDir,
        });
    }
}
exports.EditAggregator = EditAggregator;
EditAggregator._instance = null;
//# sourceMappingURL=aggregateEdits.js.map