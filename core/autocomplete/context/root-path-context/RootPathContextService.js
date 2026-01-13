"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootPathContextService = void 0;
const crypto_1 = require("crypto");
const lru_cache_1 = require("lru-cache");
const treeSitter_1 = require("../../../util/treeSitter");
const types_1 = require("../../snippets/types");
// function getSyntaxTreeString(
//   node: Parser.SyntaxNode,
//   indent: string = "",
// ): string {
//   let result = "";
//   const nodeInfo = `${node.type} [${node.startPosition.row}:${node.startPosition.column} - ${node.endPosition.row}:${node.endPosition.column}]`;
//   result += `${indent}${nodeInfo}\n`;
//   for (const child of node.children) {
//     result += getSyntaxTreeString(child, indent + "  ");
//   }
//   return result;
// }
class RootPathContextService {
    constructor(importDefinitionsService, ide) {
        this.importDefinitionsService = importDefinitionsService;
        this.ide = ide;
        this.cache = new lru_cache_1.LRUCache({
            max: 100,
        });
    }
    static getNodeId(node) {
        return `${node.startIndex}`;
    }
    /**
     * Key comes from hash of parent key and node type and node id.
     */
    static keyFromNode(parentKey, astNode) {
        return (0, crypto_1.createHash)("sha256")
            .update(parentKey)
            .update(astNode.type)
            .update(RootPathContextService.getNodeId(astNode))
            .digest("hex");
    }
    async getSnippetsForNode(filepath, node) {
        const snippets = [];
        const language = (0, treeSitter_1.getFullLanguageName)(filepath);
        let query;
        switch (node.type) {
            case "program":
                this.importDefinitionsService.get(filepath);
                break;
            default:
                // const type = node.type;
                // console.log(getSyntaxTreeString(node));
                query = await (0, treeSitter_1.getQueryForFile)(filepath, `root-path-context-queries/${language}/${node.type}.scm`);
                break;
        }
        if (!query) {
            return snippets;
        }
        const queries = query.matches(node).map(async (match) => {
            for (const item of match.captures) {
                try {
                    const endPosition = item.node.endPosition;
                    const newSnippets = await this.getSnippets(filepath, endPosition, language);
                    snippets.push(...newSnippets);
                }
                catch (e) {
                    throw e;
                }
            }
        });
        await Promise.all(queries);
        return snippets;
    }
    async getSnippets(filepath, endPosition, language) {
        const definitions = await this.ide.gotoDefinition({
            filepath,
            position: {
                line: endPosition.row,
                character: endPosition.column,
            },
        });
        const newSnippets = await Promise.all(definitions
            .filter((definition) => {
            const isIgnoredPath = treeSitter_1.IGNORE_PATH_PATTERNS[language]?.some((pattern) => pattern.test(definition.filepath));
            return !isIgnoredPath;
        })
            .map(async (def) => ({
            ...def,
            contents: await this.ide.readRangeInFile(def.filepath, def.range),
        })));
        return newSnippets;
    }
    async getContextForPath(filepath, astPath) {
        const snippets = [];
        let parentKey = filepath;
        for (const astNode of astPath.filter((node) => RootPathContextService.TYPES_TO_USE.has(node.type))) {
            const key = RootPathContextService.keyFromNode(parentKey, astNode);
            // const type = astNode.type;
            const foundInCache = this.cache.get(key);
            const newSnippets = foundInCache ?? (await this.getSnippetsForNode(filepath, astNode));
            const formattedSnippets = newSnippets.map((item) => ({
                filepath: item.filepath,
                content: item.contents,
                type: types_1.AutocompleteSnippetType.Code,
            }));
            snippets.push(...formattedSnippets);
            if (!foundInCache) {
                this.cache.set(key, newSnippets);
            }
            parentKey = key;
        }
        return snippets;
    }
}
exports.RootPathContextService = RootPathContextService;
RootPathContextService.TYPES_TO_USE = new Set([
    "arrow_function",
    "generator_function_declaration",
    "program",
    "function_declaration",
    "function_definition",
    "method_definition",
    "method_declaration",
    "class_declaration",
    "class_definition",
]);
//# sourceMappingURL=RootPathContextService.js.map