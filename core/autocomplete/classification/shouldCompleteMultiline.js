"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCompleteMultiline = shouldCompleteMultiline;
function isMidlineCompletion(prefix, suffix) {
    return !suffix.startsWith("\n");
}
function shouldCompleteMultilineBasedOnLanguage(language, prefix, suffix) {
    return language.useMultiline?.({ prefix, suffix }) ?? true;
}
function shouldCompleteMultiline(helper) {
    switch (helper.options.multilineCompletions) {
        case "always":
            return true;
        case "never":
            return false;
        default:
            break;
    }
    // Always single-line if an intellisense option is selected
    if (helper.input.selectedCompletionInfo) {
        return true;
    }
    // // Don't complete multi-line if you are mid-line
    // if (isMidlineCompletion(helper.fullPrefix, helper.fullSuffix)) {
    //   return false;
    // }
    // Don't complete multi-line for single-line comments
    if (helper.lang.singleLineComment &&
        helper.fullPrefix
            .split("\n")
            .slice(-1)[0]
            ?.trimStart()
            .startsWith(helper.lang.singleLineComment)) {
        return false;
    }
    return shouldCompleteMultilineBasedOnLanguage(helper.lang, helper.prunedPrefix, helper.prunedSuffix);
}
//# sourceMappingURL=shouldCompleteMultiline.js.map