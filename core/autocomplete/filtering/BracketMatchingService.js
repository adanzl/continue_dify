"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BracketMatchingService = exports.BRACKETS_REVERSE = exports.BRACKETS = void 0;
exports.BRACKETS = {
    "(": ")",
    "{": "}",
    "[": "]",
};
exports.BRACKETS_REVERSE = {
    ")": "(",
    "}": "{",
    "]": "[",
};
/**
 * We follow the policy of only completing bracket pairs that we started
 * But sometimes we started the pair in a previous autocomplete suggestion
 */
class BracketMatchingService {
    constructor() {
        this.openingBracketsFromLastCompletion = [];
        this.lastCompletionFile = undefined;
    }
    handleAcceptedCompletion(completion, filepath) {
        this.openingBracketsFromLastCompletion = [];
        const stack = [];
        for (let i = 0; i < completion.length; i++) {
            const char = completion[i];
            if (Object.keys(exports.BRACKETS).includes(char)) {
                // It's an opening bracket
                stack.push(char);
            }
            else if (Object.values(exports.BRACKETS).includes(char)) {
                // It's a closing bracket
                if (stack.length === 0 || exports.BRACKETS[stack.pop()] !== char) {
                    break;
                }
            }
        }
        // Any remaining opening brackets in the stack are uncompleted
        this.openingBracketsFromLastCompletion = stack;
        this.lastCompletionFile = filepath;
    }
    async *stopOnUnmatchedClosingBracket(stream, prefix, suffix, filepath, multiline) {
        let stack = [];
        if (multiline) {
            // Add opening brackets from the previous response
            if (this.lastCompletionFile === filepath) {
                stack = [...this.openingBracketsFromLastCompletion];
            }
            else {
                this.lastCompletionFile = undefined;
            }
        }
        else {
            // If single line completion, then allow completing bracket pairs that are
            // started on the current line but not finished on the current line
            if (!multiline) {
                const currentLine = (prefix.split("\n").pop() ?? "") + (suffix.split("\n")[0] ?? "");
                for (let i = 0; i < currentLine.length; i++) {
                    const char = currentLine[i];
                    if (Object.keys(exports.BRACKETS).includes(char)) {
                        // It's an opening bracket
                        stack.push(char);
                    }
                    else if (Object.values(exports.BRACKETS).includes(char)) {
                        // It's a closing bracket
                        if (stack.length === 0 || exports.BRACKETS[stack.pop()] !== char) {
                            break;
                        }
                    }
                }
            }
        }
        // Add corresponding open brackets from suffix to stack
        // because we overwrite them and the diff is displayed, and this allows something to be edited after that
        for (let i = 0; i < suffix.length; i++) {
            if (suffix[i] === " ") {
                continue;
            }
            const openBracket = exports.BRACKETS_REVERSE[suffix[i]];
            if (!openBracket) {
                break;
            }
            stack.unshift(openBracket);
        }
        let all = "";
        let seenNonWhitespaceOrClosingBracket = false;
        for await (let chunk of stream) {
            // Allow closing brackets before any non-whitespace characters
            if (!seenNonWhitespaceOrClosingBracket) {
                const firstNonWhitespaceOrClosingBracketIndex = chunk.search(/[^\s\)\}\]]/);
                if (firstNonWhitespaceOrClosingBracketIndex !== -1) {
                    yield chunk.slice(0, firstNonWhitespaceOrClosingBracketIndex);
                    chunk = chunk.slice(firstNonWhitespaceOrClosingBracketIndex);
                    seenNonWhitespaceOrClosingBracket = true;
                }
                else {
                    yield chunk;
                    continue;
                }
            }
            all += chunk;
            const allLines = all.split("\n");
            for (let i = 0; i < chunk.length; i++) {
                const char = chunk[i];
                if (Object.values(exports.BRACKETS).includes(char)) {
                    // It's a closing bracket
                    if (stack.length === 0 || exports.BRACKETS[stack.pop()] !== char) {
                        // If the stack is empty or the top of the stack doesn't match the current closing bracket
                        yield chunk.slice(0, i);
                        return; // Stop the generator if the closing bracket doesn't have a matching opening bracket in the stream
                    }
                }
                else if (Object.keys(exports.BRACKETS).includes(char)) {
                    // It's an opening bracket
                    stack.push(char);
                }
            }
            yield chunk;
        }
    }
}
exports.BracketMatchingService = BracketMatchingService;
//# sourceMappingURL=BracketMatchingService.js.map