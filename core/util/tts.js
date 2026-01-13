"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTS = void 0;
exports.sanitizeMessageForTTS = sanitizeMessageForTTS;
const child_process_1 = require("child_process");
const node_os_1 = __importDefault(require("node:os"));
const _1 = require(".");
// The amount of time before a process is declared
// a zombie after executing .kill()
const ttsKillTimeout = 5000;
/**
 * Cleans a message text to safely be used in 'exec' context on host.
 *
 * Return modified message text.
 */
function sanitizeMessageForTTS(message) {
    message = (0, _1.removeCodeBlocksAndTrim)(message);
    // Remove or replace problematic characters
    message = message
        .replace(/"/g, "")
        .replace(/`/g, "")
        .replace(/\$/g, "")
        .replace(/\\/g, "")
        .replace(/[&|;()<>]/g, "");
    message = message.trim().replace(/\s+/g, " ");
    return message;
}
class TTS {
    static async read(message) {
        message = sanitizeMessageForTTS(message);
        try {
            // Kill any active TTS processes
            await TTS.kill();
        }
        catch (e) {
            console.warn("Error killing TTS process: ", e);
            return;
        }
        switch (TTS.os) {
            case "darwin":
                TTS.handle = (0, child_process_1.exec)(`say "${message}"`);
                break;
            case "win32":
                // Replace single quotes on windows
                TTS.handle = (0, child_process_1.exec)(`powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${message.replace(/'/g, "''")}')"`);
                break;
            case "linux":
                TTS.handle = (0, child_process_1.exec)(`espeak "${message}"`);
                break;
            default:
                console.log("Text-to-speech is not supported on this operating system.");
                return;
        }
        void TTS.messenger.request("setTTSActive", true);
        TTS.handle?.once("exit", () => {
            void TTS.messenger.request("setTTSActive", false);
        });
    }
    static async kill() {
        return new Promise((resolve, reject) => {
            // Only kill a TTS process if it's still running
            if (TTS.handle && TTS.handle.exitCode === null) {
                // Use a timeout in case of zombie processes
                let killTimeout = setTimeout(() => {
                    reject(`Unable to kill TTS process: ${TTS.handle?.pid}`);
                }, ttsKillTimeout);
                // Resolve our promise once the program has exited
                TTS.handle.once("exit", () => {
                    clearTimeout(killTimeout);
                    TTS.handle = undefined;
                    resolve();
                });
                TTS.handle.kill();
            }
            else {
                resolve();
            }
        });
    }
    static async setup() {
        TTS.os = node_os_1.default.platform();
    }
}
exports.TTS = TTS;
TTS.os = undefined;
TTS.handle = undefined;
//# sourceMappingURL=tts.js.map