"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSnippets = void 0;
const uri_1 = require("../../util/uri");
const types_1 = require("../snippets/types");
const getCommentMark = (helper) => {
    return helper.lang.singleLineComment;
};
const addCommentMarks = (text, helper) => {
    const commentMark = getCommentMark(helper);
    return text
        .trim()
        .split("\n")
        .map((line) => `${commentMark} ${line}`)
        .join("\n");
};
const formatClipboardSnippet = (snippet, workspaceDirs) => {
    return formatCodeSnippet({
        filepath: "file:///Untitled.txt",
        content: snippet.content,
        type: types_1.AutocompleteSnippetType.Code,
    }, workspaceDirs);
};
const formatCodeSnippet = (snippet, workspaceDirs) => {
    return {
        ...snippet,
        content: `Path: ${(0, uri_1.getLastNUriRelativePathParts)(workspaceDirs, snippet.filepath, 2)}\n${snippet.content}`,
    };
};
const formatDiffSnippet = (snippet) => {
    return snippet;
};
const formatStaticSnippet = (snippet) => {
    return snippet;
};
const commentifySnippet = (helper, snippet) => {
    return {
        ...snippet,
        content: addCommentMarks(snippet.content, helper),
    };
};
const formatSnippets = (helper, snippets, workspaceDirs) => {
    const currentFilepathComment = addCommentMarks((0, uri_1.getLastNUriRelativePathParts)(workspaceDirs, helper.filepath, 2), helper);
    return (snippets
        .map((snippet) => {
        switch (snippet.type) {
            case types_1.AutocompleteSnippetType.Code:
                return formatCodeSnippet(snippet, workspaceDirs);
            case types_1.AutocompleteSnippetType.Diff:
                return formatDiffSnippet(snippet);
            case types_1.AutocompleteSnippetType.Clipboard:
                return formatClipboardSnippet(snippet, workspaceDirs);
            case types_1.AutocompleteSnippetType.Static:
                return formatStaticSnippet(snippet);
        }
    })
        .map((item) => {
        return commentifySnippet(helper, item).content;
    })
        .join("\n") + `\n${currentFilepathComment}`);
};
exports.formatSnippets = formatSnippets;
//# sourceMappingURL=formatting.js.map