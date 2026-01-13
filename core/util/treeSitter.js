"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullLanguageName = exports.IGNORE_PATH_PATTERNS = exports.supportedLanguages = exports.LanguageName = void 0;
exports.getParserForFile = getParserForFile;
exports.getLanguageForFile = getLanguageForFile;
exports.getQueryForFile = getQueryForFile;
exports.getSymbolsForFile = getSymbolsForFile;
exports.getSymbolsForManyFiles = getSymbolsForManyFiles;
const node_fs_1 = __importDefault(require("node:fs"));
const path_1 = __importDefault(require("path"));
const web_tree_sitter_1 = __importDefault(require("web-tree-sitter"));
const uri_1 = require("./uri");
var LanguageName;
(function (LanguageName) {
    LanguageName["CPP"] = "cpp";
    LanguageName["C_SHARP"] = "c_sharp";
    LanguageName["C"] = "c";
    LanguageName["CSS"] = "css";
    LanguageName["PHP"] = "php";
    LanguageName["BASH"] = "bash";
    LanguageName["JSON"] = "json";
    LanguageName["TYPESCRIPT"] = "typescript";
    LanguageName["TSX"] = "tsx";
    LanguageName["ELM"] = "elm";
    LanguageName["JAVASCRIPT"] = "javascript";
    LanguageName["PYTHON"] = "python";
    LanguageName["ELISP"] = "elisp";
    LanguageName["ELIXIR"] = "elixir";
    LanguageName["GO"] = "go";
    LanguageName["EMBEDDED_TEMPLATE"] = "embedded_template";
    LanguageName["HTML"] = "html";
    LanguageName["JAVA"] = "java";
    LanguageName["LUA"] = "lua";
    LanguageName["OCAML"] = "ocaml";
    LanguageName["QL"] = "ql";
    LanguageName["RESCRIPT"] = "rescript";
    LanguageName["RUBY"] = "ruby";
    LanguageName["RUST"] = "rust";
    LanguageName["SYSTEMRDL"] = "systemrdl";
    LanguageName["TOML"] = "toml";
    LanguageName["SOLIDITY"] = "solidity";
})(LanguageName || (exports.LanguageName = LanguageName = {}));
exports.supportedLanguages = {
    cpp: LanguageName.CPP,
    hpp: LanguageName.CPP,
    cc: LanguageName.CPP,
    cxx: LanguageName.CPP,
    hxx: LanguageName.CPP,
    cp: LanguageName.CPP,
    hh: LanguageName.CPP,
    inc: LanguageName.CPP,
    // Depended on this PR: https://github.com/tree-sitter/tree-sitter-cpp/pull/173
    // ccm: LanguageName.CPP,
    // c++m: LanguageName.CPP,
    // cppm: LanguageName.CPP,
    // cxxm: LanguageName.CPP,
    cs: LanguageName.C_SHARP,
    c: LanguageName.C,
    h: LanguageName.C,
    css: LanguageName.CSS,
    php: LanguageName.PHP,
    phtml: LanguageName.PHP,
    php3: LanguageName.PHP,
    php4: LanguageName.PHP,
    php5: LanguageName.PHP,
    php7: LanguageName.PHP,
    phps: LanguageName.PHP,
    "php-s": LanguageName.PHP,
    bash: LanguageName.BASH,
    sh: LanguageName.BASH,
    json: LanguageName.JSON,
    ts: LanguageName.TYPESCRIPT,
    mts: LanguageName.TYPESCRIPT,
    cts: LanguageName.TYPESCRIPT,
    tsx: LanguageName.TSX,
    // vue: LanguageName.VUE,  // tree-sitter-vue parser is broken
    // The .wasm file being used is faulty, and yaml is split line-by-line anyway for the most part
    // yaml: LanguageName.YAML,
    // yml: LanguageName.YAML,
    elm: LanguageName.ELM,
    js: LanguageName.JAVASCRIPT,
    jsx: LanguageName.JAVASCRIPT,
    mjs: LanguageName.JAVASCRIPT,
    cjs: LanguageName.JAVASCRIPT,
    py: LanguageName.PYTHON,
    // ipynb: LanguageName.PYTHON, // It contains Python, but the file format is a ton of JSON.
    pyw: LanguageName.PYTHON,
    pyi: LanguageName.PYTHON,
    el: LanguageName.ELISP,
    emacs: LanguageName.ELISP,
    ex: LanguageName.ELIXIR,
    exs: LanguageName.ELIXIR,
    go: LanguageName.GO,
    eex: LanguageName.EMBEDDED_TEMPLATE,
    heex: LanguageName.EMBEDDED_TEMPLATE,
    leex: LanguageName.EMBEDDED_TEMPLATE,
    html: LanguageName.HTML,
    htm: LanguageName.HTML,
    java: LanguageName.JAVA,
    lua: LanguageName.LUA,
    luau: LanguageName.LUA,
    ocaml: LanguageName.OCAML,
    ml: LanguageName.OCAML,
    mli: LanguageName.OCAML,
    ql: LanguageName.QL,
    res: LanguageName.RESCRIPT,
    resi: LanguageName.RESCRIPT,
    rb: LanguageName.RUBY,
    erb: LanguageName.RUBY,
    rs: LanguageName.RUST,
    rdl: LanguageName.SYSTEMRDL,
    toml: LanguageName.TOML,
    sol: LanguageName.SOLIDITY,
    // jl: LanguageName.JULIA,
    // swift: LanguageName.SWIFT,
    // kt: LanguageName.KOTLIN,
    // scala: LanguageName.SCALA,
};
exports.IGNORE_PATH_PATTERNS = {
    [LanguageName.TYPESCRIPT]: [/.*node_modules/],
    [LanguageName.JAVASCRIPT]: [/.*node_modules/],
};
async function getParserForFile(filepath) {
    try {
        await web_tree_sitter_1.default.init();
        const parser = new web_tree_sitter_1.default();
        const language = await getLanguageForFile(filepath);
        if (!language) {
            return undefined;
        }
        parser.setLanguage(language);
        return parser;
    }
    catch (e) {
        console.debug("Unable to load language for file", filepath, e);
        return undefined;
    }
}
// Loading the wasm files to create a Language object is an expensive operation and with
// sufficient number of files can result in errors, instead keep a map of language name
// to Language object
const nameToLanguage = new Map();
async function getLanguageForFile(filepath) {
    try {
        await web_tree_sitter_1.default.init();
        const extension = (0, uri_1.getUriFileExtension)(filepath);
        const languageName = exports.supportedLanguages[extension];
        if (!languageName) {
            return undefined;
        }
        let language = nameToLanguage.get(languageName);
        if (!language) {
            language = await loadLanguageForFileExt(extension);
            nameToLanguage.set(languageName, language);
        }
        return language;
    }
    catch (e) {
        console.debug("Unable to load language for file", filepath, e);
        return undefined;
    }
}
const getFullLanguageName = (filepath) => {
    const extension = (0, uri_1.getUriFileExtension)(filepath);
    return exports.supportedLanguages[extension];
};
exports.getFullLanguageName = getFullLanguageName;
async function getQueryForFile(filepath, queryPath) {
    const language = await getLanguageForFile(filepath);
    if (!language) {
        return undefined;
    }
    const sourcePath = path_1.default.join(process.env.NODE_ENV === "test" ? process.cwd() : __dirname, "..", ...(process.env.NODE_ENV === "test"
        ? ["extensions", "vscode", "tree-sitter"]
        : ["tree-sitter"]), queryPath);
    if (!node_fs_1.default.existsSync(sourcePath)) {
        return undefined;
    }
    const querySource = node_fs_1.default.readFileSync(sourcePath).toString();
    const query = language.query(querySource);
    return query;
}
async function loadLanguageForFileExt(fileExtension) {
    const wasmPath = path_1.default.join(process.env.NODE_ENV === "test" ? process.cwd() : __dirname, ...(process.env.NODE_ENV === "test"
        ? ["node_modules", "tree-sitter-wasms", "out"]
        : ["tree-sitter-wasms"]), `tree-sitter-${exports.supportedLanguages[fileExtension]}.wasm`);
    return await web_tree_sitter_1.default.Language.load(wasmPath);
}
// See https://tree-sitter.github.io/tree-sitter/using-parsers
const GET_SYMBOLS_FOR_NODE_TYPES = [
    "class_declaration",
    "class_definition",
    "function_item", // function name = first "identifier" child
    "function_definition",
    "method_declaration", // method name = first "identifier" child
    "method_definition",
    "generator_function_declaration",
    // property_identifier
    // field_declaration
    // "arrow_function",
];
async function getSymbolsForFile(filepath, contents) {
    const parser = await getParserForFile(filepath);
    if (!parser) {
        return;
    }
    let tree;
    try {
        tree = parser.parse(contents);
    }
    catch (e) {
        console.log(`Error parsing file: ${filepath}`);
        return;
    }
    // console.log(`file: ${filepath}`);
    // Function to recursively find all named nodes (classes and functions)
    const symbols = [];
    function findNamedNodesRecursive(node) {
        // console.log(`node: ${node.type}, ${node.text}`);
        if (GET_SYMBOLS_FOR_NODE_TYPES.includes(node.type)) {
            // console.log(`parent: ${node.type}, ${node.text.substring(0, 200)}`);
            // node.children.forEach((child) => {
            //   console.log(`child: ${child.type}, ${child.text}`);
            // });
            // Empirically, the actual name is the last identifier in the node
            // Especially with languages where return type is declared before the name
            // TODO use findLast in newer version of node target
            let identifier = undefined;
            for (let i = node.children.length - 1; i >= 0; i--) {
                if (node.children[i].type === "identifier" ||
                    node.children[i].type === "property_identifier") {
                    identifier = node.children[i];
                    break;
                }
            }
            if (identifier?.text) {
                symbols.push({
                    filepath,
                    type: node.type,
                    name: identifier.text,
                    range: {
                        start: {
                            character: node.startPosition.column,
                            line: node.startPosition.row,
                        },
                        end: {
                            character: node.endPosition.column + 1,
                            line: node.endPosition.row + 1,
                        },
                    },
                    content: node.text,
                });
            }
        }
        node.children.forEach(findNamedNodesRecursive);
    }
    findNamedNodesRecursive(tree.rootNode);
    return symbols;
}
async function getSymbolsForManyFiles(uris, ide) {
    const filesAndSymbols = await Promise.all(uris.map(async (uri) => {
        const contents = await ide.readFile(uri);
        let symbols = undefined;
        try {
            symbols = await getSymbolsForFile(uri, contents);
        }
        catch (e) {
            console.error(`Failed to get symbols for ${uri}:`, e);
        }
        return [uri, symbols ?? []];
    }));
    return Object.fromEntries(filesAndSymbols);
}
//# sourceMappingURL=treeSitter.js.map