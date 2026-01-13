"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_js_1 = require("../../../diff/util.js");
const index_js_1 = require("../../../util/index.js");
function commandIsPotentiallyDangerous(command) {
    return (command.includes("rm -rf") ||
        command.includes("sudo") ||
        command.includes("cd / "));
}
const GenerateTerminalCommand = {
    name: "cmd",
    description: "Generate a shell command",
    run: async function* ({ ide, llm, input }) {
        if (input.trim() === "") {
            yield "Please provide a description of the shell command you want to generate. For example, '/cmd List all files in the current directory'.";
            return;
        }
        const gen = llm.streamComplete(`The user has made a request to run a shell command. Their description of what it should do is:

"${input}"

Please write a shell command that will do what the user requested. Your output should consist of only the command itself, without any explanation or example output. Do not use any newlines. Only output the command that when inserted into the terminal will do precisely what was requested. Here is the command:`, new AbortController().signal);
        const lines = (0, util_js_1.streamLines)(gen);
        let cmd = "";
        for await (const line of lines) {
            console.log(line);
            if (line.startsWith("```") && line.endsWith("```")) {
                cmd = line.split(" ").slice(1).join(" ").slice(0, -3);
                break;
            }
            if (line.startsWith(">") ||
                line.startsWith("``") ||
                line.startsWith("\\begin{") ||
                line.trim() === "") {
                continue;
            }
            cmd = (0, index_js_1.removeQuotesAndEscapes)(line.trim());
            break;
        }
        yield `Generated shell command: ${cmd}`;
        if (commandIsPotentiallyDangerous(cmd)) {
            yield "\n\nWarning: This command may be potentially dangerous. Please double-check before pasting it in your terminal.";
        }
        else {
            await ide.runCommand(cmd);
        }
    },
};
exports.default = GenerateTerminalCommand;
//# sourceMappingURL=cmd.js.map