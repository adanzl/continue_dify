"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultApplyPrompt = exports.gptEditPrompt = void 0;
const util_1 = require("../../../util");
const gptInsertionEditPrompt = (_, otherData) => {
    return (0, util_1.dedent) `
    \`\`\`${otherData.language}
    ${otherData.prefix}[BLANK]${otherData.codeToEdit}${otherData.suffix}
    \`\`\`

    Above is the file of code that the user is currently editing in. Their cursor is located at the "[BLANK]". They have requested that you fill in the "[BLANK]" with code that satisfies the following request:

    "${otherData.userInput}"

    Please generate this code. Your output will be only the code that should replace the "[BLANK]", without repeating any of the prefix or suffix, without any natural language explanation, and without messing up indentation. Here is the code that will replace the "[BLANK]":`;
};
const gptFullFileEditPrompt = (_, otherData) => {
    return (0, util_1.dedent) `
    \`\`\`${otherData.language}
    ${otherData.codeToEdit}
    \`\`\`

    Please rewrite the above file to address the following request:

    ${otherData.userInput}

    You should rewrite the entire file without any natural language explanation. DO NOT surround the code in a code block and DO NOT explain yourself.`;
};
const gptEditPrompt = (history, otherData) => {
    if (otherData?.codeToEdit?.trim().length === 0) {
        return gptInsertionEditPrompt(history, otherData);
    }
    else if (otherData?.prefix?.trim().length === 0 &&
        otherData?.suffix?.trim().length === 0) {
        return gptFullFileEditPrompt(history, otherData);
    }
    const paragraphs = [
        "The user has requested a section of code in a file to be rewritten.",
    ];
    if (otherData.prefix?.trim().length > 0) {
        paragraphs.push((0, util_1.dedent) `
        This is the prefix of the file:
        \`\`\`${otherData.language}
        ${otherData.prefix}
        \`\`\``);
    }
    if (otherData.suffix?.trim().length > 0) {
        paragraphs.push((0, util_1.dedent) `
        This is the suffix of the file:
        \`\`\`${otherData.language}
        ${otherData.suffix}
        \`\`\``);
    }
    paragraphs.push((0, util_1.dedent) `
        This is the code to rewrite:
        \`\`\`${otherData.language}
        ${otherData.codeToEdit}
        \`\`\`

        The user's request is: "${otherData.userInput}"
        
        DO NOT output any natural language, only output the code changes.

        Here is the rewritten code:`);
    return paragraphs.join("\n\n");
};
exports.gptEditPrompt = gptEditPrompt;
const defaultApplyPrompt = (history, otherData) => {
    return `${otherData.original_code}\n\nThe following code was suggested as an edit:\n\`\`\`\n${otherData.new_code}\n\`\`\`\nPlease apply it to the previous code. Leave existing comments in place unless changes require modifying them.`;
};
exports.defaultApplyPrompt = defaultApplyPrompt;
//# sourceMappingURL=gpt.js.map