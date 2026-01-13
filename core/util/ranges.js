"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRangeInString = getRangeInString;
exports.intersection = intersection;
exports.union = union;
exports.maxPosition = maxPosition;
exports.minPosition = minPosition;
function getRangeInString(content, range) {
    const lines = content.split("\n");
    if (range.start.line === range.end.line) {
        return (lines[range.start.line]?.substring(range.start.character, range.end.character) ?? "");
    }
    const firstLine = lines[range.start.line]?.substring(range.start.character, lines[range.start.line].length) ?? "";
    const middleLines = lines.slice(range.start.line + 1, range.end.line);
    const lastLine = lines[range.end.line]?.substring(0, range.end.character) ?? "";
    return [firstLine, ...middleLines, lastLine].join("\n");
}
function intersection(a, b) {
    const startLine = Math.max(a.start.line, b.start.line);
    const endLine = Math.min(a.end.line, b.end.line);
    if (startLine > endLine) {
        return null;
    }
    if (startLine === endLine) {
        const startCharacter = Math.max(a.start.character, b.start.character);
        const endCharacter = Math.min(a.end.character, b.end.character);
        if (startCharacter > endCharacter) {
            return null;
        }
        return {
            start: { line: startLine, character: startCharacter },
            end: { line: endLine, character: endCharacter },
        };
    }
    const startCharacter = startLine === a.start.line ? a.start.character : b.start.character;
    const endCharacter = endLine === a.end.line ? a.end.character : b.end.character;
    return {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
    };
}
function union(a, b) {
    let start;
    if (a.start.line === b.start.line) {
        start = {
            line: a.start.line,
            character: Math.min(a.start.character, b.start.character),
        };
    }
    else if (a.start.line < b.start.line)
        start = a.start;
    else
        start = b.start;
    let end;
    if (a.end.line === b.end.line) {
        end = {
            line: a.end.line,
            character: Math.max(a.end.character, b.end.character),
        };
    }
    else if (a.end.line > b.end.line)
        end = a.end;
    else
        end = b.end;
    return {
        start,
        end,
    };
}
function maxPosition(a, b) {
    if (a.line > b.line) {
        return a;
    }
    else if (a.line < b.line) {
        return b;
    }
    else {
        return a.character > b.character ? a : b;
    }
}
function minPosition(a, b) {
    if (a.line < b.line) {
        return a;
    }
    else if (a.line > b.line) {
        return b;
    }
    else {
        return a.character < b.character ? a : b;
    }
}
//# sourceMappingURL=ranges.js.map