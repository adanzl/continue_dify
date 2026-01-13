"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticContextService = void 0;
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const pathToUri_1 = require("../../../util/pathToUri");
const treeSitter_1 = require("../../../util/treeSitter");
const types_1 = require("../../snippets/types");
const ast_1 = require("../../util/ast");
const tree_sitter_utils_1 = require("./tree-sitter-utils");
class StaticContextService {
    constructor(ide) {
        this.insertAtPosition = (contents, cursorPosition, insertText) => {
            const lines = contents.split(/\r?\n/); // Handle both LF and CRLF line endings
            const { line, character } = cursorPosition;
            if (line < 0 || line >= lines.length) {
                throw new Error("Invalid line number");
            }
            const targetLine = lines[line];
            if (character < 0 || character > targetLine.length) {
                throw new Error("Invalid character index");
            }
            // Insert the text
            lines[line] =
                targetLine.slice(0, character) + insertText + targetLine.slice(character);
            return lines.join("\n"); // Reconstruct the file
        };
        this.ide = ide;
    }
    logAutocompleteStaticSnippet(ctx, label = "Static Snippet") {
        console.log(`=== ${label} ===`);
        console.log("Hole Type:", ctx.holeType);
        console.log(`\nRelevant Types (${ctx.relevantTypes.size} files):`);
        ctx.relevantTypes.forEach((types, filepath) => {
            console.log(`  📁 ${filepath}`);
            types.forEach((type) => console.log(`    • ${type}`));
        });
        console.log(`\nRelevant Headers (${ctx.relevantHeaders.size} files):`);
        ctx.relevantHeaders.forEach((headers, filepath) => {
            console.log(`  📁 ${filepath}`);
            headers.forEach((header) => console.log(`    • ${header}`));
        });
    }
    static formatAutocompleteStaticSnippet(ctx) {
        let output = `AutocompleteStaticSnippet:\n`;
        output += `  holeType: ${ctx.holeType}\n`;
        output += `  relevantTypes:\n`;
        if (ctx.relevantTypes.size === 0) {
            output += `    (none)\n`;
        }
        else {
            ctx.relevantTypes.forEach((types, filepath) => {
                output += `    ${filepath}: [${types.join(", ")}]\n`;
            });
        }
        output += `  relevantHeaders:\n`;
        if (ctx.relevantHeaders.size === 0) {
            output += `    (none)\n`;
        }
        else {
            ctx.relevantHeaders.forEach((headers, filepath) => {
                output += `    ${filepath}: [${headers.join(", ")}]\n`;
            });
        }
        return output;
    }
    async getContext(helper) {
        const start = Date.now();
        const tsFiles = await this.getTypeScriptFilesFromWorkspaces(helper.workspaceUris);
        // Get the three contexts holeContext, relevantTypes, relevantHeaders.
        const holeContext = await this.getHoleContext(helper.fileContents, helper.filepath, helper.pos);
        const relevantTypes = await this.extractRelevantTypes(holeContext.fullHoverResult, holeContext.functionName, holeContext.range.start.line, holeContext.source, new Map());
        // if (this.language === "typescript") {
        //   repo = getAllTSFiles(this.repoPath);
        // } else if (this.language === "ocaml") {
        //   repo = getAllOCamlFiles(this.repoPath);
        // }
        //
        const relevantHeaders = await this.extractRelevantHeaders(tsFiles, relevantTypes, holeContext.functionTypeSpan, helper.pos, holeContext.returnTypeIsAny);
        const relevantTypesToReturn = new Map();
        relevantTypes.forEach(({ typeSpan: v, sourceFile: src }, _) => {
            if (relevantTypesToReturn.has(src)) {
                const updated = relevantTypesToReturn.get(src);
                updated.push(v);
                relevantTypesToReturn.set(src, updated);
            }
            else {
                relevantTypesToReturn.set(src, [v]);
            }
        });
        const relevantHeadersToReturn = new Map();
        relevantHeaders.forEach(({ typeSpan: v, sourceFile: src }) => {
            if (relevantHeadersToReturn.has(src)) {
                const updated = relevantHeadersToReturn.get(src);
                if (!updated.includes(v)) {
                    updated.push(v);
                }
                relevantHeadersToReturn.set(src, updated);
            }
            else {
                relevantHeadersToReturn.set(src, [v]);
            }
        });
        const ctx = {
            holeType: holeContext.functionTypeSpan,
            relevantTypes: relevantTypesToReturn,
            relevantHeaders: relevantHeadersToReturn,
        };
        const end = Date.now();
        this.logAutocompleteStaticSnippet(ctx);
        // console.log(end - start);
        const snippets = [];
        snippets.push({
            type: types_1.AutocompleteSnippetType.Static,
            filepath: (0, url_1.pathToFileURL)(path_1.default.resolve(holeContext.source)).toString(),
            content: holeContext.fullHoverResult,
        });
        for (const [filepath, typs] of ctx.relevantTypes.entries()) {
            snippets.push({
                type: types_1.AutocompleteSnippetType.Static,
                filepath: (0, url_1.pathToFileURL)(path_1.default.resolve(filepath)).toString(),
                content: typs.join("\n"),
            });
        }
        for (const [filepath, headers] of ctx.relevantHeaders.entries()) {
            snippets.push({
                type: types_1.AutocompleteSnippetType.Static,
                filepath: (0, url_1.pathToFileURL)(path_1.default.resolve(filepath)).toString(),
                content: headers.join("\n"),
            });
        }
        return snippets;
    }
    async getHoleContext(sketchFileContent, sketchFilePath, cursorPosition) {
        // We need to inject the hole @ to trigger a treesitter error node.
        sketchFilePath = (0, pathToUri_1.localPathOrUriToPath)(sketchFilePath);
        // const sketchFileContent = await fs.readFile(sketchFilePath, "utf8");
        const injectedContent = this.insertAtPosition(sketchFileContent, cursorPosition, "@;");
        // The hole's position is cursorPosition.
        // Use treesitter to parse.
        const ast = await (0, ast_1.getAst)(sketchFilePath, injectedContent);
        if (!ast) {
            throw new Error("failed to get ast");
        }
        const language = (0, treeSitter_1.getFullLanguageName)(sketchFilePath);
        const query = await (0, treeSitter_1.getQueryForFile)(sketchFilePath, `static-context-queries/hole-queries/${language}.scm`);
        if (!query) {
            throw new Error(`getHoleContext: failed to get query for file ${sketchFilePath} and language ${language}`);
        }
        const captures = query.captures(ast.rootNode);
        const res = {
            fullHoverResult: "",
            functionName: "",
            functionTypeSpan: "",
            returnTypeIsAny: false,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
            },
            source: `file://${sketchFilePath}`,
        };
        let paramsTypes = "";
        for (const c of captures) {
            const { name, node } = c;
            // console.log(`${name} →`, node.text, node.startPosition, node.endPosition);
            switch (name) {
                case "function.decl": {
                    res.fullHoverResult = node.text;
                    break;
                }
                case "function.name": {
                    res.functionName = node.text;
                    break;
                }
                case "function.params": {
                    paramsTypes = node.text;
                    res.range = {
                        start: {
                            line: node.startPosition.row,
                            character: node.startPosition.column,
                        },
                        end: {
                            line: node.endPosition.row,
                            character: node.endPosition.column,
                        },
                    };
                    break;
                }
                case "function.type": {
                    res.functionTypeSpan = node.text;
                    res.range = {
                        start: {
                            line: node.startPosition.row,
                            character: node.startPosition.column,
                        },
                        end: {
                            line: node.endPosition.row,
                            character: node.endPosition.column,
                        },
                    };
                    break;
                }
            }
        }
        if (res.functionTypeSpan === "") {
            res.functionTypeSpan = `${paramsTypes} => any`;
            res.returnTypeIsAny = true;
        }
        return res;
    }
    async extractRelevantTypes(declText, typeName, startLine, currentFile, foundContents) {
        const foundSoFar = new Map(); // identifier -> [full hover result, source]
        await this.extractRelevantTypesHelper(declText, typeName, startLine, foundSoFar, currentFile, foundContents);
        return foundSoFar;
    }
    async extractRelevantTypesHelper(declText, typeName, startLine, foundSoFar, // identifier -> [full hover result, source]
    currentFile, foundContents) {
        if (!foundSoFar.has(typeName)) {
            const ast = await (0, ast_1.getAst)(currentFile, declText);
            if (!ast) {
                throw new Error(`failed to get ast for file ${currentFile}`);
            }
            foundSoFar.set(typeName, {
                typeSpan: declText,
                sourceFile: currentFile.slice(7),
                ast: ast,
            });
            const language = (0, treeSitter_1.getFullLanguageName)(currentFile);
            const query = await (0, treeSitter_1.getQueryForFile)(currentFile, `static-context-queries/relevant-types-queries/${language}-extract-identifiers.scm`);
            if (!query) {
                throw new Error(`failed to get query for file ${currentFile} and language ${language}`);
            }
            const identifiers = query.captures(ast.rootNode);
            for (const { name, node } of identifiers) {
                if (foundSoFar.has(node.text))
                    continue;
                try {
                    const typeDefinitionResult = await this.ide.gotoTypeDefinition({
                        filepath: currentFile,
                        position: {
                            character: node.startPosition.column,
                            line: startLine + node.startPosition.row,
                        },
                    });
                    if (typeDefinitionResult.length > 0) {
                        const tdLocation = typeDefinitionResult[0];
                        let content = "";
                        if (foundContents.has(tdLocation.filepath)) {
                            content = foundContents.get(tdLocation.filepath);
                        }
                        else {
                            content = await this.ide.readFile(tdLocation.filepath);
                            foundContents.set(tdLocation.filepath, content);
                        }
                        const ast = await (0, ast_1.getAst)(tdLocation.filepath, content);
                        if (!ast) {
                            throw new Error(`failed to get ast for file ${tdLocation.filepath}`);
                        }
                        const decl = (0, tree_sitter_utils_1.findEnclosingTypeDeclaration)(content, tdLocation.range.start.line, tdLocation.range.start.character, ast);
                        if (!decl) {
                            // throw new Error(`failed to get decl for file ${tdLocation.uri}`);
                            console.error(`failed to get decl for file ${tdLocation.filepath}`);
                        }
                        if (decl) {
                            await this.extractRelevantTypesHelper(decl.fullText, node.text, tdLocation.range.start.line, foundSoFar, tdLocation.filepath, foundContents);
                        }
                        else {
                            // console.log("decl not found");
                        }
                    }
                    else {
                        // console.log("td not found");
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
    }
    async extractRelevantHeaders(sources, relevantTypes, holeType, cursorPosition, returnTypeIsAny) {
        const relevantContext = new Set();
        if (returnTypeIsAny)
            return relevantContext;
        // NOTE: This is necessary because TypeScript sucks.
        // There is no way to compare objects by value,
        // so sets of objects starts to accumulate tons of duplicates.
        const relevantContextMap = new Map();
        const foundNormalForms = new Map();
        const targetTypes = await this.generateTargetTypes(relevantTypes, holeType);
        for (const source of sources) {
            const topLevelDecls = await (0, tree_sitter_utils_1.extractTopLevelDecls)(source);
            for (const tld of topLevelDecls) {
                // pattern 0 is let/const, 1 is var, 2 is fun
                // if (!seenDecls.has(JSON.stringify()) {
                const originalDeclText = tld.pattern === 2
                    ? tld.captures.find((d) => d.name === "top.fn.decl").node.text
                    : tld.captures.find((d) => d.name === "top.var.decl").node.text;
                if (tld.pattern === 2) {
                    // build a type span
                    // TODO: this fails sometimes with Cannot read properties of undefined (reading 'text')
                    // most likely due to my scm query and how I'm not attaching param name along with param type
                    let funcType = "";
                    try {
                        funcType = (0, tree_sitter_utils_1.extractFunctionTypeFromDecl)(tld);
                    }
                    catch (err) {
                        // Most likely is the case that there is no explicit return type annotation.
                        const sigHelp = await this.ide.getSignatureHelp({
                            filepath: source,
                            position: cursorPosition,
                        });
                        if (!sigHelp)
                            continue;
                        funcType = sigHelp.signatures[0].label;
                        // TODO: This only works for TypeScript.
                        function convertToArrowType(signature) {
                            // Handle various function declaration formats.
                            const patterns = [
                                // Standard: functionName(params): returnType.
                                /^(\w+)\s*\((.*?)\)\s*:\s*(.+)$/,
                                // With generics: functionName<T>(params): returnType.
                                /^(\w+)\s*<[^>]*>\s*\((.*?)\)\s*:\s*(.+)$/,
                                // With modifiers: export function functionName(params): returnType.
                                /^(?:export\s+)?(?:function\s+)?(\w+)\s*\((.*?)\)\s*:\s*(.+)$/,
                            ];
                            for (const pattern of patterns) {
                                const match = signature.match(pattern);
                                if (match) {
                                    const [, , parameters, returnType] = match;
                                    return `(${parameters}) => ${returnType}`;
                                }
                            }
                            return signature;
                        }
                        funcType = convertToArrowType(funcType);
                    }
                    const wrapped = `type __TMP = ${funcType};`;
                    const ast = await (0, ast_1.getAst)("file.ts", wrapped);
                    if (!ast) {
                        throw new Error(`failed to generate ast for ${wrapped}`);
                    }
                    // console.log(ast.rootNode);
                    const alias = ast.rootNode.namedChild(0);
                    // console.log(alias);
                    if (!alias || alias.type !== "type_alias_declaration") {
                        throw new Error("extractRelevantHeaders: Failed to parse type alias");
                    }
                    const valueNode = alias.childForFieldName("value");
                    if (!valueNode)
                        throw new Error("No type value found");
                    const baseNode = (0, tree_sitter_utils_1.unwrapToBaseType)(valueNode);
                    await this.extractRelevantHeadersHelper(originalDeclText, baseNode, targetTypes, relevantTypes, relevantContext, relevantContextMap, foundNormalForms, source);
                }
                else {
                    const varTypNode = tld.captures.find((d) => d.name === "top.var.type").node;
                    await this.extractRelevantHeadersHelper(originalDeclText, varTypNode, targetTypes, relevantTypes, relevantContext, relevantContextMap, foundNormalForms, source);
                }
            }
        }
        for (const v of relevantContextMap.values()) {
            relevantContext.add(v);
        }
        return relevantContext;
    }
    async extractRelevantHeadersHelper(originalDeclText, node, targetTypes, relevantTypes, relevantContext, relevantContextMap, foundNormalForms, source) {
        for (const typ of targetTypes) {
            if (await this.isTypeEquivalent(node, typ, relevantTypes, foundNormalForms)) {
                const ctx = { typeSpan: originalDeclText, sourceFile: source };
                relevantContextMap.set(JSON.stringify(ctx), ctx);
            }
            if (node.type === "function_type") {
                const retTypeNode = node.namedChildren.find((c) => c && c.type === "return_type");
                if (retTypeNode) {
                    await this.extractRelevantHeadersHelper(originalDeclText, retTypeNode, targetTypes, relevantTypes, relevantContext, relevantContextMap, foundNormalForms, source);
                }
            }
            else if (node.type === "tuple_type") {
                for (const c of node.namedChildren) {
                    await this.extractRelevantHeadersHelper(originalDeclText, c, targetTypes, relevantTypes, relevantContext, relevantContextMap, foundNormalForms, source);
                }
            }
        }
    }
    async generateTargetTypes(relevantTypes, holeType) {
        const targetTypes = new Set();
        // const ast = relevantTypes.get(holeIdentifier)!.ast;
        const ast = await (0, ast_1.getAst)("file.ts", `type T = ${holeType};`);
        if (!ast) {
            throw new Error(`failed to generate ast for ${holeType}`);
        }
        const alias = ast.rootNode.namedChild(0);
        if (!alias || alias.type !== "type_alias_declaration") {
            throw new Error("generateTargetTypes: Failed to parse type alias");
        }
        const valueNode = alias.childForFieldName("value");
        if (!valueNode)
            throw new Error("No type value found");
        const baseNode = (0, tree_sitter_utils_1.unwrapToBaseType)(valueNode);
        targetTypes.add(baseNode);
        await this.generateTargetTypesHelper(relevantTypes, holeType, targetTypes, baseNode);
        return targetTypes;
    }
    async generateTargetTypesHelper(relevantTypes, currType, targetTypes, node) {
        if (!node)
            return;
        if (node.type === "function_type") {
            const returnType = node.childForFieldName("return_type");
            if (returnType) {
                targetTypes.add(returnType);
                await this.generateTargetTypesHelper(relevantTypes, currType, targetTypes, returnType);
            }
        }
        if (node.type === "tuple_type") {
            for (const child of node.namedChildren) {
                if (child) {
                    targetTypes.add(child);
                    await this.generateTargetTypesHelper(relevantTypes, currType, targetTypes, child);
                }
            }
        }
        if (relevantTypes.has(node.text)) {
            // const ast = relevantTypes.get(node.text)!.ast;
            const typeSpan = relevantTypes.get(node.text)?.typeSpan;
            // const ast = await getAst("file.ts", `type T = ${typeSpan}`);
            const ast = await (0, ast_1.getAst)("file.ts", typeSpan);
            if (!ast) {
                throw new Error(`failed to generate ast for ${typeSpan}`);
            }
            const alias = ast.rootNode.namedChild(0);
            if (!alias || alias.type !== "type_alias_declaration") {
                console.error("generateTargetTypesHelper: Failed to parse type alias");
                return;
                // throw new Error(
                //   "generateTargetTypesHelper: Failed to parse type alias",
                // );
            }
            const valueNode = alias.childForFieldName("value");
            if (!valueNode)
                throw new Error("No type value found");
            const baseNode = (0, tree_sitter_utils_1.unwrapToBaseType)(valueNode);
            await this.generateTargetTypesHelper(relevantTypes, currType, targetTypes, baseNode);
        }
        // if (node.type === "type_identifier" || node.type === "predefined_type") {
        //   return [node.text];
        // }
        return;
    }
    async isTypeEquivalent(node, typ, relevantTypes, foundNormalForms) {
        if (!node || !typ) {
            return false;
        }
        let normT1 = "";
        let normT2 = "";
        if (foundNormalForms.has(node.text)) {
            // console.log("found t1", true)
            normT1 = foundNormalForms.get(node.text);
        }
        else {
            // console.log("not found t1", false)
            normT1 = await this.normalize(node, relevantTypes);
            foundNormalForms.set(node.text, normT1);
        }
        if (foundNormalForms.has(typ.text)) {
            // console.log("found t2", true)
            normT2 = foundNormalForms.get(typ.text);
        }
        else {
            // console.log("not found t2", false)
            normT2 = await this.normalize(typ, relevantTypes);
            foundNormalForms.set(typ.text, normT2);
        }
        // const normT1 = foundNormalForms.has(t1) ? foundNormalForms.get(t1) : this.normalize2(t1, relevantTypes);
        // const normT2 = foundNormalForms.has(t2) ? foundNormalForms.get(t2) : this.normalize2(t2, relevantTypes);
        // console.log(`normal forms: ${normT1} {}{} ${normT2}`)
        return normT1 === normT2;
    }
    async normalize(node, relevantTypes) {
        if (!node)
            return "";
        switch (node.type) {
            case "function_type": {
                const params = node.child(0); // formal_parameters
                const returnType = node.childForFieldName("type") || node.namedChildren[1]; // function_type → parameters, =>, return
                const paramTypes = params?.namedChildren
                    .map((param) => this.normalize(param.childForFieldName("type") ||
                    param.namedChildren.at(-1), relevantTypes))
                    .join(", ") || "";
                const ret = this.normalize(returnType, relevantTypes);
                return `(${paramTypes}) => ${ret}`;
            }
            case "tuple_type": {
                const elements = node.namedChildren.map((c) => this.normalize(c, relevantTypes));
                return `[${elements.join(", ")}]`;
            }
            case "union_type": {
                const parts = node.namedChildren.map((c) => this.normalize(c, relevantTypes));
                return parts.join(" | ");
            }
            case "type_identifier": {
                const alias = relevantTypes.get(node.text);
                if (!alias)
                    return node.text;
                // Parse the alias's type span
                const wrapped = `type __TMP = ${alias};`;
                const tree = await (0, ast_1.getAst)("file.ts", wrapped);
                const valueNode = tree.rootNode
                    .descendantsOfType("type_alias_declaration")[0]
                    ?.childForFieldName("value");
                return this.normalize(valueNode, relevantTypes);
            }
            case "predefined_type":
            case "number":
            case "string":
                return node.text;
            default:
                // Fallback for types like array, etc.
                return node.text;
        }
    }
    async getTypeScriptFilesFromWorkspaces(workspaceUris) {
        const tsExtensions = [".ts"];
        const allTsFiles = [];
        for (const workspaceUri of workspaceUris) {
            try {
                // Convert URI to file path
                const folderPath = workspaceUri.startsWith("file://")
                    ? new URL(workspaceUri).pathname
                    : workspaceUri;
                const tsFiles = await this.scanDirectoryForTypeScriptFiles(folderPath, tsExtensions);
                allTsFiles.push(...tsFiles);
            }
            catch (error) {
                console.error(`Error scanning workspace ${workspaceUri}:`, error);
            }
        }
        return allTsFiles;
    }
    async scanDirectoryForTypeScriptFiles(dirPath, tsExtensions) {
        const tsFiles = [];
        const shouldSkipDirectory = (dirName) => {
            const skipDirs = [
                "node_modules",
                ".git",
                ".vscode",
                "dist",
                "build",
                "out",
                ".next",
                "coverage",
                ".nyc_output",
                "tmp",
                "temp",
                ".cache",
            ];
            return skipDirs.includes(dirName) || dirName.startsWith(".");
        };
        const scanRecursively = async (currentPath) => {
            try {
                const currentUri = (0, url_1.pathToFileURL)(currentPath).toString();
                const entries = await this.ide.listDir(currentUri);
                for (const [name, fileType] of entries) {
                    const fullPath = (0, pathToUri_1.localPathOrUriToPath)(path_1.default.join(currentPath, name));
                    if (fileType === 2) {
                        if (!shouldSkipDirectory(name)) {
                            await scanRecursively(fullPath);
                        }
                    }
                    else if (fileType === 1) {
                        const extension = path_1.default.extname(name).toLowerCase();
                        if (tsExtensions.includes(extension)) {
                            tsFiles.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error reading directory ${currentPath}:`, error);
            }
        };
        await scanRecursively(dirPath);
        return tsFiles;
    }
}
exports.StaticContextService = StaticContextService;
//# sourceMappingURL=StaticContextService.js.map