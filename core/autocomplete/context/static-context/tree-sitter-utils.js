"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEnclosingTypeDeclaration = findEnclosingTypeDeclaration;
exports.extractTopLevelDecls = extractTopLevelDecls;
exports.extractTopLevelDeclsWithFormatting = extractTopLevelDeclsWithFormatting;
exports.extractFunctionTypeFromDecl = extractFunctionTypeFromDecl;
exports.unwrapToBaseType = unwrapToBaseType;
const fs = __importStar(require("fs/promises"));
const treeSitter_1 = require("../../../util/treeSitter");
const ast_1 = require("../../util/ast");
function findEnclosingTypeDeclaration(sourceCode, cursorLine, cursorColumn, ast) {
    const point = { row: cursorLine, column: cursorColumn };
    let node = ast.rootNode.descendantForPosition(point);
    while (node &&
        ![
            "type_alias_declaration",
            "interface_declaration",
            "enum_declaration",
        ].includes(node.type)) {
        if (!node.parent)
            return null;
        node = node.parent;
    }
    if (!node)
        return null;
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text ?? "<anonymous>";
    const fullText = sourceCode.slice(node.startIndex, node.endIndex);
    return {
        name,
        fullText,
        startLine: node.startPosition.row,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row,
        endColumn: node.endPosition.column,
        kind: node.type,
    };
}
async function extractTopLevelDecls(currentFile, givenParser) {
    const ast = await (0, ast_1.getAst)(currentFile, await fs.readFile(currentFile, "utf8"));
    if (!ast) {
        throw new Error(`failed to get ast for file ${currentFile}`);
    }
    let language;
    if (givenParser) {
        language = givenParser.getLanguage();
    }
    else {
        language = (0, treeSitter_1.getFullLanguageName)(currentFile);
    }
    const query = await (0, treeSitter_1.getQueryForFile)(currentFile, `static-context-queries/relevant-headers-queries/${language}-get-toplevel-headers.scm`);
    if (!query) {
        throw new Error(`failed to get query for file ${currentFile} and language ${language}`);
    }
    return query.matches(ast.rootNode);
}
async function extractTopLevelDeclsWithFormatting(currentFile, givenParser) {
    const ast = await (0, ast_1.getAst)(currentFile, await fs.readFile(currentFile, "utf8"));
    if (!ast) {
        throw new Error(`failed to get ast for file ${currentFile}`);
    }
    let language;
    if (givenParser) {
        language = givenParser.getLanguage();
    }
    else {
        language = (0, treeSitter_1.getFullLanguageName)(currentFile);
    }
    const query = await (0, treeSitter_1.getQueryForFile)(currentFile, `static-context-queries/relevant-headers-queries/${language}-get-toplevel-headers.scm`);
    if (!query) {
        throw new Error(`failed to get query for file ${currentFile} and language ${language}`);
    }
    const matches = query.matches(ast.rootNode);
    const results = [];
    for (const match of matches) {
        const item = {
            declaration: "",
            nodeType: "",
            name: "",
            declaredType: "",
        };
        for (const { name, node } of match.captures) {
            if (name === "top.var.decl") {
                item.nodeType = "variable";
                item.declaration = node.text;
                // Attempt to get the declared type (e.g., const x: string = ...)
                const typeNode = node.descendantsOfType("type_annotation")[0];
                if (typeNode) {
                    item.declaredType = typeNode.text.replace(/^:\s*/, "");
                }
            }
            else if (name === "top.var.name" || name === "top.fn.name") {
                item.name = node.text;
            }
            else if (name === "top.fn.decl") {
                item.nodeType = "function";
                item.declaration = node.text;
                // Get the return type (e.g., function foo(): string)
                const returnTypeNode = node.childForFieldName("return_type");
                if (returnTypeNode) {
                    item.returnType = returnTypeNode.text.replace(/^:\s*/, "");
                }
                // Get declaredType if needed (TypeScript style)
                const nameNode = node.childForFieldName("name");
                if (nameNode && nameNode.nextSibling?.type === "type_annotation") {
                    item.declaredType = nameNode.nextSibling.text.replace(/^:\s*/, "");
                }
            }
        }
        if (item.name && item.declaration) {
            results.push(item);
        }
    }
    return results;
}
function extractFunctionTypeFromDecl(match) {
    let paramsNode = undefined;
    let returnNode = undefined;
    for (const capture of match.captures) {
        if (capture.name === "top.fn.param.type") {
            paramsNode = capture.node;
        }
        else if (capture.name === "top.fn.type") {
            returnNode = capture.node;
        }
    }
    if (!paramsNode) {
        console.error(`extractFunctionTypeFromDecl: paramsNode ${paramsNode} not found`);
        throw new Error(`extractFunctionTypeFromDecl: paramsNode ${paramsNode} not found`);
    }
    if (!returnNode) {
        console.error(`extractFunctionTypeFromDecl: returnNode ${returnNode} not found`);
        throw new Error(`extractFunctionTypeFromDecl: returnNode ${returnNode} not found`);
    }
    return `(${paramsNode.text}) => ${returnNode.text}`;
}
function unwrapToBaseType(node) {
    if ([
        "function_type",
        "tuple_type",
        "type_identifier",
        "predefined_type",
    ].includes(node.type)) {
        return node;
    }
    for (const child of node.namedChildren) {
        const unwrapped = unwrapToBaseType(child);
        if (unwrapped !== child ||
            [
                "function_type",
                "tuple_type",
                "type_identifier",
                "predefined_type",
            ].includes(unwrapped.type)) {
            return unwrapped;
        }
    }
    return node;
}
//# sourceMappingURL=tree-sitter-utils.js.map