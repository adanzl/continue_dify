"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSnippet = void 0;
const types_1 = require("../snippets/types");
const MAX_CLIPBOARD_AGE = 5 * 60 * 1000;
const isValidClipboardSnippet = (snippet) => {
    const currDate = new Date();
    const isTooOld = currDate.getTime() - new Date(snippet.copiedAt).getTime() >
        MAX_CLIPBOARD_AGE;
    return !isTooOld;
};
const isValidSnippet = (snippet) => {
    if (snippet.content.trim() === "")
        return false;
    if (snippet.type === types_1.AutocompleteSnippetType.Clipboard) {
        return isValidClipboardSnippet(snippet);
    }
    if (snippet.filepath?.startsWith("output:extension-output-Continue.continue")) {
        return false;
    }
    return true;
};
exports.isValidSnippet = isValidSnippet;
//# sourceMappingURL=validation.js.map