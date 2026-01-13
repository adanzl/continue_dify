"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructInitialPrefixSuffix = constructInitialPrefixSuffix;
const ranges_1 = require("../../util/ranges");
const AutocompleteLanguageInfo_1 = require("../constants/AutocompleteLanguageInfo");
/**
 * We have to handle a few edge cases in getting the entire prefix/suffix for the current file.
 * This is entirely prior to finding snippets from other files
 */
async function constructInitialPrefixSuffix(input, ide) {
    const lang = (0, AutocompleteLanguageInfo_1.languageForFilepath)(input.filepath);
    const fileContents = input.manuallyPassFileContents ?? (await ide.readFile(input.filepath));
    const fileLines = fileContents.split("\n");
    let prefix = (0, ranges_1.getRangeInString)(fileContents, {
        start: { line: 0, character: 0 },
        end: input.selectedCompletionInfo?.range.start ?? input.pos,
    }) + (input.selectedCompletionInfo?.text ?? "");
    if (input.injectDetails) {
        const lines = prefix.split("\n");
        prefix = `${lines.slice(0, -1).join("\n")}\n${lang.singleLineComment} ${input.injectDetails
            .split("\n")
            .join(`\n${lang.singleLineComment} `)}\n${lines[lines.length - 1]}`;
    }
    const suffix = (0, ranges_1.getRangeInString)(fileContents, {
        start: input.pos,
        end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
    });
    return { prefix, suffix };
}
//# sourceMappingURL=constructPrefixSuffix.js.map