"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelperVars = void 0;
const countTokens_1 = require("../../llm/countTokens");
const AutocompleteLanguageInfo_1 = require("../constants/AutocompleteLanguageInfo");
const constructPrefixSuffix_1 = require("../templating/constructPrefixSuffix");
const ast_1 = require("./ast");
/**
 * A collection of variables that are often accessed throughout the autocomplete pipeline
 * It's noisy to re-calculate all the time or inject them into each function
 */
class HelperVars {
    constructor(input, options, modelName, ide) {
        this.input = input;
        this.options = options;
        this.modelName = modelName;
        this.ide = ide;
        this.workspaceUris = [];
        this.lang = (0, AutocompleteLanguageInfo_1.languageForFilepath)(input.filepath);
    }
    async init() {
        // Don't do anything if already initialized
        if (this._fileContents !== undefined) {
            return;
        }
        this.workspaceUris = await this.ide.getWorkspaceDirs();
        this._fileContents =
            this.input.manuallyPassFileContents ??
                (await this.ide.readFile(this.filepath));
        this._fileLines = this._fileContents.split("\n");
        // Construct full prefix/suffix (a few edge cases handled in here)
        const { prefix: fullPrefix, suffix: fullSuffix } = await (0, constructPrefixSuffix_1.constructInitialPrefixSuffix)(this.input, this.ide);
        this._fullPrefix = fullPrefix;
        this._fullSuffix = fullSuffix;
        const { prunedPrefix, prunedSuffix } = this.prunePrefixSuffix();
        this._prunedPrefix = prunedPrefix;
        this._prunedSuffix = prunedSuffix;
        try {
            const ast = await (0, ast_1.getAst)(this.filepath, fullPrefix + fullSuffix);
            if (ast) {
                this.treePath = await (0, ast_1.getTreePathAtCursor)(ast, fullPrefix.length);
            }
        }
        catch (e) {
            console.error("Failed to parse AST", e);
        }
    }
    static async create(input, options, modelName, ide) {
        const instance = new HelperVars(input, options, modelName, ide);
        await instance.init();
        return instance;
    }
    prunePrefixSuffix() {
        // Construct basic prefix
        const maxPrefixTokens = this.options.maxPromptTokens * this.options.prefixPercentage;
        const prunedPrefix = (0, countTokens_1.pruneLinesFromTop)(this.fullPrefix, maxPrefixTokens, this.modelName);
        // Construct suffix
        const maxSuffixTokens = Math.min(this.options.maxPromptTokens - (0, countTokens_1.countTokens)(prunedPrefix, this.modelName), this.options.maxSuffixPercentage * this.options.maxPromptTokens);
        const prunedSuffix = (0, countTokens_1.pruneLinesFromBottom)(this.fullSuffix, maxSuffixTokens, this.modelName);
        return {
            prunedPrefix,
            prunedSuffix,
        };
    }
    // Fast access
    get filepath() {
        return this.input.filepath;
    }
    get pos() {
        return this.input.pos;
    }
    get prunedCaretWindow() {
        return this.prunedPrefix + this.prunedSuffix;
    }
    // Getters for lazy access
    get fileContents() {
        if (this._fileContents === undefined) {
            throw new Error("HelperVars must be initialized before accessing fileContents");
        }
        return this._fileContents;
    }
    get fileLines() {
        if (this._fileLines === undefined) {
            throw new Error("HelperVars must be initialized before accessing fileLines");
        }
        return this._fileLines;
    }
    get fullPrefix() {
        if (this._fullPrefix === undefined) {
            throw new Error("HelperVars must be initialized before accessing fullPrefix");
        }
        return this._fullPrefix;
    }
    get fullSuffix() {
        if (this._fullSuffix === undefined) {
            throw new Error("HelperVars must be initialized before accessing fullSuffix");
        }
        return this._fullSuffix;
    }
    get prunedPrefix() {
        if (this._prunedPrefix === undefined) {
            throw new Error("HelperVars must be initialized before accessing prunedPrefix");
        }
        return this._prunedPrefix;
    }
    get prunedSuffix() {
        if (this._prunedSuffix === undefined) {
            throw new Error("HelperVars must be initialized before accessing prunedSuffix");
        }
        return this._prunedSuffix;
    }
}
exports.HelperVars = HelperVars;
//# sourceMappingURL=HelperVars.js.map