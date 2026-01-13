"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAst = getAst;
exports.getTreePathAtCursor = getTreePathAtCursor;
exports.getScopeAroundRange = getScopeAroundRange;
const treeSitter_1 = require("../../util/treeSitter");
async function getAst(filepath, fileContents) {
    const parser = await (0, treeSitter_1.getParserForFile)(filepath);
    if (!parser) {
        return undefined;
    }
    try {
        const ast = parser.parse(fileContents);
        return ast;
    }
    catch (e) {
        return undefined;
    }
}
async function getTreePathAtCursor(ast, cursorIndex) {
    const path = [ast.rootNode];
    while (path[path.length - 1].childCount > 0) {
        let foundChild = false;
        for (const child of path[path.length - 1].children) {
            if (child.startIndex <= cursorIndex && child.endIndex >= cursorIndex) {
                path.push(child);
                foundChild = true;
                break;
            }
        }
        if (!foundChild) {
            break;
        }
    }
    return path;
}
async function getScopeAroundRange(range) {
    const ast = await getAst(range.filepath, range.contents);
    if (!ast) {
        return undefined;
    }
    const { start: s, end: e } = range.range;
    const lines = range.contents.split("\n");
    const startIndex = lines.slice(0, s.line).join("\n").length +
        (lines[s.line]?.slice(s.character).length ?? 0);
    const endIndex = lines.slice(0, e.line).join("\n").length +
        (lines[e.line]?.slice(0, e.character).length ?? 0);
    let node = ast.rootNode;
    while (node.childCount > 0) {
        let foundChild = false;
        for (const child of node.children) {
            if (child.startIndex < startIndex && child.endIndex > endIndex) {
                node = child;
                foundChild = true;
                break;
            }
        }
        if (!foundChild) {
            break;
        }
    }
    return {
        contents: node.text,
        filepath: range.filepath,
        range: {
            start: {
                line: node.startPosition.row,
                character: node.startPosition.column,
            },
            end: {
                line: node.endPosition.row,
                character: node.endPosition.column,
            },
        },
    };
}
//# sourceMappingURL=ast.js.map