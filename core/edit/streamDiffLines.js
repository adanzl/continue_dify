"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addIndentation = addIndentation;
exports.streamDiffLines = streamDiffLines;
const lineStream_1 = require("../autocomplete/filtering/streamTransforms/lineStream");
const streamDiff_1 = require("../diff/streamDiff");
const util_1 = require("../diff/util");
const getSystemMessageWithRules_1 = require("../llm/rules/getSystemMessageWithRules");
const edit_1 = require("../llm/templates/edit");
const gpt_1 = require("../llm/templates/edit/gpt");
const findLast_1 = require("../util/findLast");
const posthog_1 = require("../util/posthog");
const recursiveStream_1 = require("./recursiveStream");
function constructEditPrompt(prefix, highlighted, suffix, llm, userInput, language) {
    const template = llm.promptTemplates?.edit ?? edit_1.gptEditPrompt;
    return llm.renderPromptTemplate(template, [], {
        userInput,
        prefix,
        codeToEdit: highlighted,
        suffix,
        language: language ?? "",
    });
}
function constructApplyPrompt(originalCode, newCode, llm) {
    const template = llm.promptTemplates?.apply ?? gpt_1.defaultApplyPrompt;
    const rendered = llm.renderPromptTemplate(template, [], {
        original_code: originalCode,
        new_code: newCode,
    });
    return rendered;
}
async function* addIndentation(diffLineGenerator, indentation) {
    for await (const diffLine of diffLineGenerator) {
        yield {
            ...diffLine,
            line: indentation + diffLine.line,
        };
    }
}
function modelIsInept(model) {
    return !(model.includes("gpt") || model.includes("claude"));
}
async function* streamDiffLines(options, llm, abortController, overridePrompt, rulesToInclude) {
    const { type, prefix, highlighted, suffix, input, language } = options;
    void posthog_1.Telemetry.capture("inlineEdit", {
        model: llm.model,
        provider: llm.providerName,
    }, true);
    // Strip common indentation for the LLM, then add back after generation
    let oldLines = highlighted.length > 0
        ? highlighted.split("\n")
        : // When highlighted is empty, we need to combine last line of prefix and first line of suffix to determine the line being edited
            [(prefix + suffix).split("\n")[prefix.split("\n").length - 1]];
    // But if that line is empty, we can assume we are insertion-only
    if (oldLines.length === 1 && oldLines[0].trim() === "") {
        oldLines = [];
    }
    // Defaults to creating an edit prompt
    // For apply can be overridden with simply apply prompt
    let prompt = overridePrompt ??
        (type === "apply"
            ? constructApplyPrompt(oldLines.join("\n"), options.newCode, llm)
            : constructEditPrompt(prefix, highlighted, suffix, llm, input, language));
    // Rules can be included with edit prompt
    // If any rules are present this will result in using chat instead of legacy completion
    const systemMessage = rulesToInclude || llm.baseChatSystemMessage
        ? (0, getSystemMessageWithRules_1.getSystemMessageWithRules)({
            availableRules: rulesToInclude ?? [],
            userMessage: typeof prompt === "string"
                ? {
                    role: "user",
                    content: prompt,
                }
                : (0, findLast_1.findLast)(prompt, (msg) => msg.role === "user" || msg.role === "tool"),
            baseSystemMessage: llm.baseChatSystemMessage,
            contextItems: [],
        }).systemMessage
        : undefined;
    if (systemMessage) {
        if (typeof prompt === "string") {
            prompt = [
                {
                    role: "system",
                    content: systemMessage,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ];
        }
        else {
            const curSysMsg = prompt.find((msg) => msg.role === "system");
            if (curSysMsg) {
                curSysMsg.content = systemMessage + "\n\n" + curSysMsg.content;
            }
            else {
                prompt.unshift({
                    role: "system",
                    content: systemMessage,
                });
            }
        }
    }
    const inept = modelIsInept(llm.model);
    const prediction = {
        type: "content",
        content: highlighted,
    };
    const completion = (0, recursiveStream_1.recursiveStream)(llm, abortController, type, prompt, prediction);
    let lines = (0, util_1.streamLines)(completion);
    lines = (0, lineStream_1.filterEnglishLinesAtStart)(lines);
    lines = (0, lineStream_1.filterCodeBlockLines)(lines);
    lines = (0, lineStream_1.stopAtLines)(lines, () => { });
    lines = (0, lineStream_1.skipLines)(lines);
    lines = (0, lineStream_1.removeTrailingWhitespace)(lines);
    if (inept) {
        // lines = fixCodeLlamaFirstLineIndentation(lines);
        lines = (0, lineStream_1.filterEnglishLinesAtEnd)(lines);
    }
    let diffLines = (0, streamDiff_1.streamDiff)(oldLines, lines);
    diffLines = (0, lineStream_1.filterLeadingAndTrailingNewLineInsertion)(diffLines);
    if (highlighted.length === 0) {
        const line = prefix.split("\n").slice(-1)[0];
        const indentation = line.slice(0, line.length - line.trimStart().length);
        diffLines = addIndentation(diffLines, indentation);
    }
    for await (const diffLine of diffLines) {
        yield diffLine;
    }
}
//# sourceMappingURL=streamDiffLines.js.map