"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTerminalCommandImpl = void 0;
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const node_child_process_1 = __importDefault(require("node:child_process"));
const node_os_1 = __importDefault(require("node:os"));
const errors_1 = require("../../util/errors");
// Automatically decode the buffer according to the platform to avoid garbled Chinese
function getDecodedOutput(data) {
    if (process.platform === "win32") {
        try {
            let out = iconv_lite_1.default.decode(data, "utf-8");
            if (/�/.test(out)) {
                out = iconv_lite_1.default.decode(data, "gbk");
            }
            return out;
        }
        catch {
            return iconv_lite_1.default.decode(data, "gbk");
        }
    }
    else {
        return data.toString();
    }
} // Simple helper function to use login shell on Unix/macOS and PowerShell on Windows
function getShellCommand(command) {
    if (process.platform === "win32") {
        // Windows: Use PowerShell
        return {
            shell: "powershell.exe",
            args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
        };
    }
    else {
        // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
        const userShell = process.env.SHELL || "/bin/bash";
        return { shell: userShell, args: ["-l", "-c", command] };
    }
}
const node_url_1 = require("node:url");
const processTerminalStates_1 = require("../../util/processTerminalStates");
const parseArgs_1 = require("../parseArgs");
/**
 * Resolves the working directory from workspace dirs.
 * Falls back to home directory or temp directory if no workspace is available.
 */
function resolveWorkingDirectory(workspaceDirs) {
    const fileWorkspaceDir = workspaceDirs.find((dir) => dir.startsWith("file:/"));
    if (fileWorkspaceDir) {
        return (0, node_url_1.fileURLToPath)(fileWorkspaceDir);
    }
    // Default to user's home directory with fallbacks
    try {
        return process.env.HOME || process.env.USERPROFILE || process.cwd();
    }
    catch {
        // Final fallback if even process.cwd() fails - use system temp directory
        return node_os_1.default.tmpdir();
    }
}
// Add color-supporting environment variables
const getColorEnv = () => ({
    ...process.env,
    FORCE_COLOR: "1",
    COLORTERM: "truecolor",
    TERM: "xterm-256color",
    CLICOLOR: "1",
    CLICOLOR_FORCE: "1",
});
const ENABLED_FOR_REMOTES = [
    "",
    "local",
    "wsl",
    "dev-container",
    "devcontainer",
    "ssh-remote",
    "attached-container",
    "codespaces",
    "tunnel",
];
const runTerminalCommandImpl = async (args, extras) => {
    const command = (0, parseArgs_1.getStringArg)(args, "command");
    // Default to waiting for completion if not specified
    const waitForCompletion = (0, parseArgs_1.getBooleanArg)(args, "waitForCompletion", false) ?? true;
    const ideInfo = await extras.ide.getIdeInfo();
    const toolCallId = extras.toolCallId || "";
    if (ENABLED_FOR_REMOTES.includes(ideInfo.remoteName)) {
        // For streaming output
        if (extras.onPartialOutput) {
            try {
                const workspaceDirs = await extras.ide.getWorkspaceDirs();
                const cwd = resolveWorkingDirectory(workspaceDirs);
                return new Promise((resolve, reject) => {
                    let terminalOutput = "";
                    if (!waitForCompletion) {
                        const status = "Command is running in the background...";
                        if (extras.onPartialOutput) {
                            extras.onPartialOutput({
                                toolCallId,
                                contextItems: [
                                    {
                                        name: "Terminal",
                                        description: "Terminal command output",
                                        content: "",
                                        status: status,
                                    },
                                ],
                            });
                        }
                    }
                    // Use spawn with color environment
                    const { shell, args } = getShellCommand(command);
                    const childProc = node_child_process_1.default.spawn(shell, args, {
                        cwd,
                        env: getColorEnv(), // Add enhanced environment for colors
                    });
                    // Track this process for foreground cancellation
                    if (toolCallId && waitForCompletion) {
                        (0, processTerminalStates_1.markProcessAsRunning)(toolCallId, childProc, extras.onPartialOutput, terminalOutput);
                    }
                    childProc.stdout?.on("data", (data) => {
                        // Skip if this process has been backgrounded
                        if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId))
                            return;
                        const newOutput = getDecodedOutput(data);
                        terminalOutput += newOutput;
                        // Update the tracked output for potential cancellation notifications
                        if (toolCallId && waitForCompletion) {
                            (0, processTerminalStates_1.updateProcessOutput)(toolCallId, terminalOutput);
                        }
                        // Send partial output to UI
                        if (extras.onPartialOutput) {
                            const status = waitForCompletion
                                ? ""
                                : "Command is running in the background...";
                            extras.onPartialOutput({
                                toolCallId,
                                contextItems: [
                                    {
                                        name: "Terminal",
                                        description: "Terminal command output",
                                        content: terminalOutput,
                                        status: status,
                                    },
                                ],
                            });
                        }
                    });
                    childProc.stderr?.on("data", (data) => {
                        // Skip if this process has been backgrounded
                        if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId))
                            return;
                        const newOutput = getDecodedOutput(data);
                        terminalOutput += newOutput;
                        // Update the tracked output for potential cancellation notifications
                        if (toolCallId && waitForCompletion) {
                            (0, processTerminalStates_1.updateProcessOutput)(toolCallId, terminalOutput);
                        }
                        // Send partial output to UI, status is not required
                        if (extras.onPartialOutput) {
                            extras.onPartialOutput({
                                toolCallId,
                                contextItems: [
                                    {
                                        name: "Terminal",
                                        description: "Terminal command output",
                                        content: terminalOutput,
                                    },
                                ],
                            });
                        }
                    });
                    // If we don't need to wait for completion, resolve immediately
                    if (!waitForCompletion) {
                        const status = "Command is running in the background...";
                        resolve([
                            {
                                name: "Terminal",
                                description: "Terminal command output",
                                content: terminalOutput,
                                status: status,
                            },
                        ]);
                    }
                    childProc.on("close", (code) => {
                        // Clean up process tracking
                        if (toolCallId) {
                            if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId)) {
                                (0, processTerminalStates_1.removeBackgroundedProcess)(toolCallId);
                                return;
                            }
                            // Remove from foreground tracking if it was tracked
                            (0, processTerminalStates_1.removeRunningProcess)(toolCallId);
                        }
                        if (waitForCompletion) {
                            // Normal completion, resolve now
                            if (!code || code === 0) {
                                const status = "Command completed";
                                resolve([
                                    {
                                        name: "Terminal",
                                        description: "Terminal command output",
                                        content: terminalOutput,
                                        status: status,
                                    },
                                ]);
                            }
                            else {
                                const status = `Command failed with exit code ${code}`;
                                resolve([
                                    {
                                        name: "Terminal",
                                        description: "Terminal command output",
                                        content: terminalOutput,
                                        status: status,
                                    },
                                ]);
                            }
                        }
                        else {
                            // Already resolved, just update the UI with final output
                            if (extras.onPartialOutput) {
                                const status = code === 0 || !code
                                    ? "\nBackground command completed"
                                    : `\nBackground command failed with exit code ${code}`;
                                extras.onPartialOutput({
                                    toolCallId,
                                    contextItems: [
                                        {
                                            name: "Terminal",
                                            description: "Terminal command output",
                                            content: terminalOutput,
                                            status: status,
                                        },
                                    ],
                                });
                            }
                        }
                    });
                    childProc.on("error", (error) => {
                        // Clean up process tracking
                        if (toolCallId) {
                            if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId)) {
                                (0, processTerminalStates_1.removeBackgroundedProcess)(toolCallId);
                                return;
                            }
                            // Remove from foreground tracking if it was tracked
                            (0, processTerminalStates_1.removeRunningProcess)(toolCallId);
                        }
                        reject(error);
                    });
                });
            }
            catch (error) {
                throw error;
            }
        }
        else {
            // Fallback to non-streaming for older clients
            const workspaceDirs = await extras.ide.getWorkspaceDirs();
            const cwd = resolveWorkingDirectory(workspaceDirs);
            if (waitForCompletion) {
                // Standard execution, waiting for completion
                try {
                    // Use spawn approach for consistency with streaming version
                    const { shell: nonStreamingShell, args: nonStreamingArgs } = getShellCommand(command);
                    const output = await new Promise((resolve, reject) => {
                        const childProc = node_child_process_1.default.spawn(nonStreamingShell, nonStreamingArgs, {
                            cwd,
                            env: getColorEnv(),
                        });
                        // Track this process for foreground cancellation
                        if (toolCallId) {
                            (0, processTerminalStates_1.markProcessAsRunning)(toolCallId, childProc, undefined, "");
                        }
                        let stdout = "";
                        let stderr = "";
                        childProc.stdout?.on("data", (data) => {
                            stdout += getDecodedOutput(data);
                        });
                        childProc.stderr?.on("data", (data) => {
                            stderr += getDecodedOutput(data);
                        });
                        childProc.on("close", (code) => {
                            // Clean up process tracking
                            if (toolCallId) {
                                (0, processTerminalStates_1.removeRunningProcess)(toolCallId);
                            }
                            if (code === 0) {
                                resolve({ stdout, stderr });
                            }
                            else {
                                const error = new errors_1.ContinueError(errors_1.ContinueErrorReason.CommandExecutionFailed, `Command failed with exit code ${code}`);
                                error.stderr = stderr;
                                reject(error);
                            }
                        });
                        childProc.on("error", (error) => {
                            // Clean up process tracking
                            if (toolCallId) {
                                (0, processTerminalStates_1.removeRunningProcess)(toolCallId);
                            }
                            reject(error);
                        });
                    });
                    const status = "Command completed";
                    return [
                        {
                            name: "Terminal",
                            description: "Terminal command output",
                            content: output.stdout ?? "",
                            status: status,
                        },
                    ];
                }
                catch (error) {
                    const status = `Command failed with: ${error.message || error.toString()}`;
                    return [
                        {
                            name: "Terminal",
                            description: "Terminal command output",
                            content: error.stderr ?? error.toString(),
                            status: status,
                        },
                    ];
                }
            }
            else {
                // For non-streaming but also not waiting for completion, use spawn
                // but don't attach any listeners other than error
                try {
                    // Use spawn with color environment
                    const { shell: detachedShell, args: detachedArgs } = getShellCommand(command);
                    const childProc = node_child_process_1.default.spawn(detachedShell, detachedArgs, {
                        cwd,
                        env: getColorEnv(), // Add color environment
                        // Detach the process so it's not tied to the parent
                        detached: true,
                        // Redirect to /dev/null equivalent (works cross-platform)
                        stdio: "ignore",
                    });
                    // Even for detached processes, add event handlers to clean up the background process map
                    childProc.on("close", () => {
                        if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId)) {
                            (0, processTerminalStates_1.removeBackgroundedProcess)(toolCallId);
                        }
                    });
                    childProc.on("error", () => {
                        if ((0, processTerminalStates_1.isProcessBackgrounded)(toolCallId)) {
                            (0, processTerminalStates_1.removeBackgroundedProcess)(toolCallId);
                        }
                    });
                    // Unref the child to allow the Node.js process to exit
                    childProc.unref();
                    const status = "Command is running in the background...";
                    return [
                        {
                            name: "Terminal",
                            description: "Terminal command output",
                            content: status,
                            status: status,
                        },
                    ];
                }
                catch (error) {
                    const status = `Command failed with: ${error.message || error.toString()}`;
                    return [
                        {
                            name: "Terminal",
                            description: "Terminal command output",
                            content: status,
                            status: status,
                        },
                    ];
                }
            }
        }
    }
    // For remote environments, just run the command
    // Note: waitForCompletion is not supported in remote environments yet
    await extras.ide.runCommand(command);
    return [
        {
            name: "Terminal",
            description: "Terminal command output",
            content: "Terminal output not available. This is only available in local development environments and not in SSH environments for example.",
            status: "Command failed",
        },
    ];
};
exports.runTerminalCommandImpl = runTerminalCommandImpl;
//# sourceMappingURL=runTerminalCommand.js.map