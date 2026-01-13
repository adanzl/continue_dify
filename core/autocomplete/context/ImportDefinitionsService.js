"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportDefinitionsService = void 0;
const LruCache_1 = require("../../util/LruCache");
const treeSitter_1 = require("../../util/treeSitter");
const uri_1 = require("../../util/uri");
class ImportDefinitionsService {
    constructor(ide) {
        this.ide = ide;
        this.cache = new LruCache_1.PrecalculatedLruCache(this._getFileInfo.bind(this), ImportDefinitionsService.N);
        ide.onDidChangeActiveTextEditor((filepath) => {
            this.cache
                .initKey(filepath)
                .catch((e) => console.warn(`Failed to initialize ImportDefinitionService: ${e.message}`));
        });
    }
    get(filepath) {
        return this.cache.get(filepath);
    }
    async _getFileInfo(filepath) {
        if (filepath.endsWith(".ipynb")) {
            // Commenting out this line was the solution to https://github.com/continuedev/continue/issues/1463
            return null;
        }
        const parser = await (0, treeSitter_1.getParserForFile)(filepath);
        if (!parser) {
            return {
                imports: {},
            };
        }
        let fileContents = undefined;
        try {
            const { foundInDir } = (0, uri_1.findUriInDirs)(filepath, await this.ide.getWorkspaceDirs());
            if (!foundInDir) {
                return null;
            }
            else {
                fileContents = await this.ide.readFile(filepath);
            }
        }
        catch (err) {
            // File removed
            return null;
        }
        const ast = parser.parse(fileContents, undefined, {
            includedRanges: [
                {
                    startIndex: 0,
                    endIndex: 10000,
                    startPosition: { row: 0, column: 0 },
                    endPosition: { row: 100, column: 0 },
                },
            ],
        });
        const language = (0, treeSitter_1.getFullLanguageName)(filepath);
        const query = await (0, treeSitter_1.getQueryForFile)(filepath, `import-queries/${language}.scm`);
        if (!query) {
            return {
                imports: {},
            };
        }
        const matches = query?.matches(ast.rootNode);
        const fileInfo = {
            imports: {},
        };
        for (const match of matches) {
            const startPosition = match.captures[0].node.startPosition;
            const defs = await this.ide.gotoDefinition({
                filepath,
                position: {
                    line: startPosition.row,
                    character: startPosition.column,
                },
            });
            fileInfo.imports[match.captures[0].node.text] = await Promise.all(defs.map(async (def) => ({
                ...def,
                contents: await this.ide.readRangeInFile(def.filepath, def.range),
            })));
        }
        return fileInfo;
    }
}
exports.ImportDefinitionsService = ImportDefinitionsService;
ImportDefinitionsService.N = 10;
//# sourceMappingURL=ImportDefinitionsService.js.map