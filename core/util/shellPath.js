"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvPathFromUserShell = getEnvPathFromUserShell;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function getEnvPathFromUserShell() {
    if (process.platform === "win32") {
        console.warn(`${getEnvPathFromUserShell.name} not implemented for Windows`);
        return undefined;
    }
    if (!process.env.SHELL) {
        return undefined;
    }
    try {
        // Source common profile files
        const command = `${process.env.SHELL} -l -c 'for f in ~/.zprofile ~/.zshrc ~/.bash_profile ~/.bashrc; do [ -f "$f" ] && source "$f" 2>/dev/null; done; echo $PATH'`;
        const { stdout } = await execAsync(command, {
            encoding: "utf8",
        });
        return stdout.trim();
    }
    catch (error) {
        return process.env.PATH; // Fallback to current PATH
    }
}
//# sourceMappingURL=shellPath.js.map