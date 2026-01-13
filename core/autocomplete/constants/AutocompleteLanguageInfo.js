"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANGUAGES = exports.Markdown = exports.Json = exports.YAML = exports.Lua = exports.Solidity = exports.Dart = exports.R = exports.FSharp = exports.Julia = exports.Clojure = exports.Ruby = exports.Kotlin = exports.Swift = exports.RubyOnRails = exports.PHP = exports.Haskell = exports.Rust = exports.Go = exports.Scala = exports.C = exports.CSharp = exports.Cpp = exports.Java = exports.Python = exports.JavaScript = exports.Typescript = void 0;
exports.languageForFilepath = languageForFilepath;
const uri_1 = require("../../util/uri");
const BracketMatchingService_1 = require("../filtering/BracketMatchingService");
// TypeScript
exports.Typescript = {
    name: "TypeScript",
    topLevelKeywords: ["function", "class", "module", "export", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// JavaScript
exports.JavaScript = {
    name: "JavaScript",
    topLevelKeywords: ["function", "class", "module", "export", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Python
exports.Python = {
    name: "Python",
    // """"#" is for .ipynb files, where we add '"""' surrounding markdown blocks.
    // This stops the model from trying to complete the start of a new markdown block
    topLevelKeywords: ["def", "class", '"""#'],
    singleLineComment: "#",
    endOfLine: [],
};
// Java
exports.Java = {
    name: "Java",
    topLevelKeywords: ["class", "function"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// C++
exports.Cpp = {
    name: "C++",
    topLevelKeywords: ["class", "namespace", "template"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// C#
exports.CSharp = {
    name: "C#",
    topLevelKeywords: ["class", "namespace", "void"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// C
exports.C = {
    name: "C",
    topLevelKeywords: ["if", "else", "while", "for", "switch", "case"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Scala
exports.Scala = {
    name: "Scala",
    topLevelKeywords: ["def", "val", "var", "class", "object", "trait"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Go
exports.Go = {
    name: "Go",
    topLevelKeywords: ["func", "package", "import", "type"],
    singleLineComment: "//",
    endOfLine: [],
};
// Rust
exports.Rust = {
    name: "Rust",
    topLevelKeywords: ["fn", "mod", "pub", "struct", "enum", "trait"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Haskell
exports.Haskell = {
    name: "Haskell",
    topLevelKeywords: [
        "data",
        "type",
        "newtype",
        "class",
        "instance",
        "let",
        "in",
        "where",
    ],
    singleLineComment: "--",
    endOfLine: [],
};
// PHP
exports.PHP = {
    name: "PHP",
    topLevelKeywords: ["function", "class", "namespace", "use"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Ruby on Rails
exports.RubyOnRails = {
    name: "Ruby on Rails",
    topLevelKeywords: ["def", "class", "module"],
    singleLineComment: "#",
    endOfLine: [],
};
// Swift
exports.Swift = {
    name: "Swift",
    topLevelKeywords: ["func", "class", "struct", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Kotlin
exports.Kotlin = {
    name: "Kotlin",
    topLevelKeywords: ["fun", "class", "package", "import"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Ruby
exports.Ruby = {
    name: "Ruby",
    topLevelKeywords: ["class", "module", "def"],
    singleLineComment: "#",
    endOfLine: [],
};
// Clojure
exports.Clojure = {
    name: "Clojure",
    topLevelKeywords: ["def", "fn", "let", "do", "if", "defn", "ns", "defmacro"],
    singleLineComment: ";",
    endOfLine: [],
};
// Julia
exports.Julia = {
    name: "Julia",
    topLevelKeywords: [
        "function",
        "macro",
        "if",
        "else",
        "elseif",
        "while",
        "for",
        "begin",
        "end",
        "module",
    ],
    singleLineComment: "#",
    endOfLine: [";"],
};
// F#
exports.FSharp = {
    name: "F#",
    topLevelKeywords: [
        "let",
        "type",
        "module",
        "namespace",
        "open",
        "if",
        "then",
        "else",
        "match",
        "with",
    ],
    singleLineComment: "//",
    endOfLine: [],
};
// R
exports.R = {
    name: "R",
    topLevelKeywords: [
        "function",
        "if",
        "else",
        "for",
        "while",
        "repeat",
        "library",
        "require",
    ],
    singleLineComment: "#",
    endOfLine: [],
};
// Dart
exports.Dart = {
    name: "Dart",
    topLevelKeywords: ["class", "import", "void", "enum"],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Solidity
exports.Solidity = {
    name: "Solidity",
    topLevelKeywords: [
        "contract",
        "event",
        "modifier",
        "function",
        "constructor",
        "for",
        "require",
        "emit",
        "interface",
        "error",
        "library",
        "struct",
        "enum",
        "type",
    ],
    singleLineComment: "//",
    endOfLine: [";"],
};
// Lua
exports.Lua = {
    name: "Lua",
    topLevelKeywords: ["function"],
    singleLineComment: "--",
    endOfLine: [],
};
// YAML
exports.YAML = {
    name: "YAML",
    topLevelKeywords: [],
    singleLineComment: "#",
    endOfLine: [],
    lineFilters: [
        // Only display one list item at a time
        async function* ({ lines, fullStop }) {
            let seenListItem = false;
            for await (const line of lines) {
                if (line.trim().startsWith("- ")) {
                    if (seenListItem) {
                        fullStop();
                        break;
                    }
                    else {
                        seenListItem = true;
                    }
                }
                yield line;
            }
        },
        // Don't allow consecutive lines of same key
        async function* ({ lines }) {
            let lastKey = undefined;
            for await (const line of lines) {
                if (line.includes(":")) {
                    const key = line.split(":")[0];
                    if (key === lastKey) {
                        break;
                    }
                    else {
                        yield line;
                        lastKey = key;
                    }
                }
                else {
                    yield line;
                }
            }
        },
    ],
};
exports.Json = {
    name: "JSON",
    topLevelKeywords: [],
    singleLineComment: "//",
    endOfLine: [",", "}", "]"],
    charFilters: [
        function matchBrackets({ chars, prefix, suffix, filepath, multiline }) {
            const bracketMatchingService = new BracketMatchingService_1.BracketMatchingService();
            return bracketMatchingService.stopOnUnmatchedClosingBracket(chars, prefix, suffix, filepath, multiline);
        },
    ],
};
exports.Markdown = {
    name: "Markdown",
    topLevelKeywords: [],
    singleLineComment: "",
    endOfLine: [],
    useMultiline: ({ prefix, suffix }) => {
        const singleLineStarters = ["- ", "* ", /^\d+\. /, "> ", "```", /^#{1,6} /];
        let currentLine = prefix.split("\n").pop();
        if (!currentLine) {
            return true;
        }
        currentLine = currentLine.trim();
        for (const starter of singleLineStarters) {
            if (typeof starter === "string"
                ? currentLine.startsWith(starter)
                : starter.test(currentLine)) {
                return false;
            }
        }
        return true;
    },
};
exports.LANGUAGES = {
    ts: exports.Typescript,
    js: exports.JavaScript,
    tsx: exports.Typescript,
    json: exports.Json,
    jsx: exports.Typescript,
    ipynb: exports.Python,
    py: exports.Python,
    pyi: exports.Python,
    java: exports.Java,
    cpp: exports.Cpp,
    cxx: exports.Cpp,
    h: exports.Cpp,
    hpp: exports.Cpp,
    cs: exports.CSharp,
    c: exports.C,
    scala: exports.Scala,
    sc: exports.Scala,
    go: exports.Go,
    rs: exports.Rust,
    hs: exports.Haskell,
    php: exports.PHP,
    rb: exports.Ruby,
    rails: exports.RubyOnRails,
    swift: exports.Swift,
    kt: exports.Kotlin,
    clj: exports.Clojure,
    cljs: exports.Clojure,
    cljc: exports.Clojure,
    jl: exports.Julia,
    fs: exports.FSharp,
    fsi: exports.FSharp,
    fsx: exports.FSharp,
    fsscript: exports.FSharp,
    r: exports.R,
    R: exports.R,
    dart: exports.Dart,
    sol: exports.Solidity,
    yaml: exports.YAML,
    yml: exports.YAML,
    md: exports.Markdown,
    lua: exports.Lua,
    luau: exports.Lua,
};
function languageForFilepath(fileUri) {
    const extension = (0, uri_1.getUriFileExtension)(fileUri);
    return exports.LANGUAGES[extension] || exports.Typescript;
}
//# sourceMappingURL=AutocompleteLanguageInfo.js.map