"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLemonadeInstalled = isLemonadeInstalled;
exports.startLocalLemonade = startLocalLemonade;
const node_child_process_1 = require("node:child_process");
async function isLemonadeInstalled() {
    // On Windows, check if lemonade-server command exists
    if (process.platform === "win32") {
        return new Promise((resolve, _reject) => {
            (0, node_child_process_1.exec)("where.exe lemonade-server", (error, _stdout, _stderr) => {
                resolve(!error);
            });
        });
    }
    // On Linux, check if the health endpoint is accessible
    try {
        const response = await fetch("http://localhost:8000/api/v1/health", {
            method: "GET",
            signal: AbortSignal.timeout(3000), // 3 second timeout
        });
        if (response.ok) {
            const data = await response.json();
            return data.status === "ok";
        }
        return false;
    }
    catch {
        return false;
    }
}
async function startLocalLemonade(ide) {
    let startCommand;
    switch (process.platform) {
        case "linux": // Linux
            // On Linux, direct users to start Lemonade manually
            return ide.showToast("info", "Please start Lemonade manually. Visit https://lemonade-server.ai for instructions.");
        case "win32": // Windows
            startCommand = "lemonade-server serve\n";
            break;
        default:
            return ide.showToast("error", "Cannot start Lemonade: platform not supported!");
    }
    if (startCommand) {
        return ide.runCommand(startCommand, {
            reuseTerminal: true,
            terminalName: "Start Lemonade",
        });
    }
}
//# sourceMappingURL=lemonadeHelper.js.map