"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markProcessAsBackgrounded = markProcessAsBackgrounded;
exports.isProcessBackgrounded = isProcessBackgrounded;
exports.removeBackgroundedProcess = removeBackgroundedProcess;
exports.markProcessAsRunning = markProcessAsRunning;
exports.isProcessRunning = isProcessRunning;
exports.getRunningProcess = getRunningProcess;
exports.updateProcessOutput = updateProcessOutput;
exports.removeRunningProcess = removeRunningProcess;
exports.killTerminalProcess = killTerminalProcess;
exports.killMultipleTerminalProcesses = killMultipleTerminalProcesses;
exports.killAllRunningTerminalProcesses = killAllRunningTerminalProcesses;
exports.getAllRunningProcessIds = getAllRunningProcessIds;
exports.getAllBackgroundedProcessIds = getAllBackgroundedProcessIds;
exports.clearAllBackgroundProcesses = clearAllBackgroundProcesses;
// Track which processes have been backgrounded
const processTerminalBackgroundStates = new Map();
const processTerminalForegroundStates = new Map();
// Background process functions (existing)
function markProcessAsBackgrounded(toolCallId) {
    processTerminalBackgroundStates.set(toolCallId, true);
}
function isProcessBackgrounded(toolCallId) {
    return processTerminalBackgroundStates.has(toolCallId);
}
function removeBackgroundedProcess(toolCallId) {
    processTerminalBackgroundStates.delete(toolCallId);
}
// Foreground process functions (new)
function markProcessAsRunning(toolCallId, process, onPartialOutput, currentOutput = "") {
    processTerminalForegroundStates.set(toolCallId, {
        process,
        onPartialOutput,
        currentOutput,
    });
}
function isProcessRunning(toolCallId) {
    return processTerminalForegroundStates.has(toolCallId);
}
function getRunningProcess(toolCallId) {
    const info = processTerminalForegroundStates.get(toolCallId);
    return info?.process;
}
function updateProcessOutput(toolCallId, output) {
    const info = processTerminalForegroundStates.get(toolCallId);
    if (info) {
        info.currentOutput = output;
    }
}
function removeRunningProcess(toolCallId) {
    processTerminalForegroundStates.delete(toolCallId);
}
async function killTerminalProcess(toolCallId) {
    const processInfo = processTerminalForegroundStates.get(toolCallId);
    if (processInfo && !processInfo.process.killed) {
        const { process } = processInfo;
        process.kill("SIGTERM");
        // Force kill after 5 seconds if still running
        setTimeout(() => {
            if (!process.killed) {
                process.kill("SIGKILL");
            }
        }, 5000);
        processTerminalForegroundStates.delete(toolCallId);
    }
}
// Function to cancel multiple terminal commands at once
async function killMultipleTerminalProcesses(toolCallIds) {
    const cancelPromises = toolCallIds.map((toolCallId) => killTerminalProcess(toolCallId));
    await Promise.all(cancelPromises);
}
// Function to cancel ALL currently running terminal commands
async function killAllRunningTerminalProcesses() {
    const runningIds = getAllRunningProcessIds();
    if (runningIds.length > 0) {
        await killMultipleTerminalProcesses(runningIds);
    }
    return runningIds; // Return the IDs that were cancelled
}
// Utility functions
function getAllRunningProcessIds() {
    return Array.from(processTerminalForegroundStates.keys());
}
function getAllBackgroundedProcessIds() {
    return Array.from(processTerminalBackgroundStates.keys());
}
// Utility function for testing - clears all background process states
function clearAllBackgroundProcesses() {
    processTerminalBackgroundStates.clear();
}
//# sourceMappingURL=processTerminalStates.js.map