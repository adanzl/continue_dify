"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messageContent_js_1 = require("../../../util/messageContent.js");
const CommitMessageCommand = {
    name: "commit",
    description: "Generate a commit message for current changes",
    run: async function* ({ ide, llm, params, abortController }) {
        const includeUnstaged = params?.includeUnstaged ?? false;
        const diff = await ide.getDiff(includeUnstaged);
        if (diff.length === 0) {
            yield "No changes detected. Make sure you are in a git repository with current changes.";
            return;
        }
        const prompt = `${diff.join("\n")}\n\nGenerate a commit message for the above set of changes. First, give a single sentence, no more than 80 characters. Then, after 2 line breaks, give a list of no more than 5 short bullet points, each no more than 40 characters. Output nothing except for the commit message, and don't surround it in quotes.`;
        for await (const chunk of llm.streamChat([{ role: "user", content: prompt }], abortController.signal)) {
            yield (0, messageContent_js_1.renderChatMessage)(chunk);
        }
    },
};
exports.default = CommitMessageCommand;
//# sourceMappingURL=commit.js.map