"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultIgnoreFileAndDir = exports.defaultFileAndFolderSecurityIgnores = exports.DEFAULT_IGNORE = exports.DEFAULT_SECURITY_IGNORE = exports.defaultIgnoreDir = exports.defaultIgnoreFile = exports.defaultSecurityIgnoreDir = exports.defaultSecurityIgnoreFile = exports.defaultIgnoresGlob = exports.DEFAULT_IGNORES = exports.DEFAULT_IGNORE_DIRS = exports.DEFAULT_IGNORE_FILETYPES = exports.ADDITIONAL_INDEXING_IGNORE_DIRS = exports.ADDITIONAL_INDEXING_IGNORE_FILETYPES = exports.DEFAULT_SECURITY_IGNORE_DIRS = exports.DEFAULT_SECURITY_IGNORE_FILETYPES = void 0;
exports.isSecurityConcern = isSecurityConcern;
exports.throwIfFileIsSecurityConcern = throwIfFileIsSecurityConcern;
exports.gitIgArrayFromFile = gitIgArrayFromFile;
const ignore_1 = __importDefault(require("ignore"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const errors_1 = require("../util/errors");
// Security-focused ignore patterns - these should always be excluded for security reasons
exports.DEFAULT_SECURITY_IGNORE_FILETYPES = [
    // Environment and configuration files with secrets
    "*.env",
    "*.env.*",
    ".env*",
    "config.json",
    "config.yaml",
    "config.yml",
    "settings.json",
    "appsettings.json",
    "appsettings.*.json",
    // Certificate and key files
    "*.key",
    "*.pem",
    "*.p12",
    "*.pfx",
    "*.crt",
    "*.cer",
    "*.jks",
    "*.keystore",
    "*.truststore",
    // Database files that may contain sensitive data
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "*.mdb",
    "*.accdb",
    // Credential and secret files
    "*.secret",
    "*.secrets",
    "auth.json",
    "*.token",
    // Backup files that might contain sensitive data
    "*.bak",
    "*.backup",
    "*.old",
    "*.orig",
    // Docker secrets
    "docker-compose.override.yml",
    "docker-compose.override.yaml",
    // SSH and GPG
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "*.ppk",
    "*.gpg",
];
exports.DEFAULT_SECURITY_IGNORE_DIRS = [
    // Environment and configuration directories
    ".env/",
    "env/",
    // Cloud provider credential directories
    ".aws/",
    ".gcp/",
    ".azure/",
    ".kube/",
    ".docker/",
    // Secret directories
    "secrets/",
    ".secrets/",
    "private/",
    ".private/",
    "certs/",
    "certificates/",
    "keys/",
    ".ssh/",
    ".gnupg/",
    ".gpg/",
    // Temporary directories that might contain sensitive data
    "tmp/secrets/",
    "temp/secrets/",
    ".tmp/",
];
// Additional non-security patterns for general indexing exclusion
exports.ADDITIONAL_INDEXING_IGNORE_FILETYPES = [
    "*.DS_Store",
    "*-lock.json",
    "*.lock",
    "*.log",
    "*.ttf",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.mp4",
    "*.svg",
    "*.ico",
    "*.pdf",
    "*.zip",
    "*.gz",
    "*.tar",
    "*.dmg",
    "*.tgz",
    "*.rar",
    "*.7z",
    "*.exe",
    "*.dll",
    "*.obj",
    "*.o",
    "*.o.d",
    "*.a",
    "*.lib",
    "*.so",
    "*.dylib",
    "*.ncb",
    "*.sdf",
    "*.woff",
    "*.woff2",
    "*.eot",
    "*.cur",
    "*.avi",
    "*.mpg",
    "*.mpeg",
    "*.mov",
    "*.mp3",
    "*.mkv",
    "*.webm",
    "*.jar",
    "*.onnx",
    "*.parquet",
    "*.pqt",
    "*.wav",
    "*.webp",
    "*.wasm",
    "*.plist",
    "*.profraw",
    "*.gcda",
    "*.gcno",
    "go.sum",
    "*.gitignore",
    "*.gitkeep",
    "*.continueignore",
    "*.csv",
    "*.uasset",
    "*.pdb",
    "*.bin",
    "*.pag",
    "*.swp",
    "*.jsonl",
    // "*.prompt", // can be incredibly confusing for the LLM to have another set of instructions injected into the prompt
    // Application specific
    ".continue/",
];
exports.ADDITIONAL_INDEXING_IGNORE_DIRS = [
    ".git/",
    ".svn/",
    "node_modules/",
    "dist/",
    "build/",
    "Build/",
    "target/",
    "out/",
    "bin/",
    ".pytest_cache/",
    ".vscode-test/",
    "__pycache__/",
    "site-packages/",
    ".gradle/",
    ".mvn/",
    ".cache/",
    "gems/",
    "vendor/",
    ".venv/",
    "venv/",
    ".vscode/",
    ".idea/",
    ".vs/",
];
// Combined patterns: security + additional
exports.DEFAULT_IGNORE_FILETYPES = [
    ...exports.DEFAULT_SECURITY_IGNORE_FILETYPES,
    ...exports.ADDITIONAL_INDEXING_IGNORE_FILETYPES,
];
exports.DEFAULT_IGNORE_DIRS = [
    ...exports.DEFAULT_SECURITY_IGNORE_DIRS,
    ...exports.ADDITIONAL_INDEXING_IGNORE_DIRS,
];
exports.DEFAULT_IGNORES = [
    ...exports.DEFAULT_IGNORE_FILETYPES,
    ...exports.DEFAULT_IGNORE_DIRS,
];
exports.defaultIgnoresGlob = `!{${exports.DEFAULT_IGNORES.join(",")}}`;
// Create ignore instances
exports.defaultSecurityIgnoreFile = (0, ignore_1.default)().add(exports.DEFAULT_SECURITY_IGNORE_FILETYPES);
exports.defaultSecurityIgnoreDir = (0, ignore_1.default)().add(exports.DEFAULT_SECURITY_IGNORE_DIRS);
exports.defaultIgnoreFile = (0, ignore_1.default)().add(exports.DEFAULT_IGNORE_FILETYPES);
exports.defaultIgnoreDir = (0, ignore_1.default)().add(exports.DEFAULT_IGNORE_DIRS);
// String representations
exports.DEFAULT_SECURITY_IGNORE = exports.DEFAULT_SECURITY_IGNORE_FILETYPES.join("\n") +
    "\n" +
    exports.DEFAULT_SECURITY_IGNORE_DIRS.join("\n");
exports.DEFAULT_IGNORE = exports.DEFAULT_IGNORE_FILETYPES.join("\n") + "\n" + exports.DEFAULT_IGNORE_DIRS.join("\n");
// Combined ignore instances
exports.defaultFileAndFolderSecurityIgnores = (0, ignore_1.default)()
    .add(exports.defaultSecurityIgnoreFile)
    .add(exports.defaultSecurityIgnoreDir);
exports.defaultIgnoreFileAndDir = (0, ignore_1.default)()
    .add(exports.defaultIgnoreFile)
    .add(exports.defaultIgnoreDir);
function isSecurityConcern(filePathOrUri) {
    if (!filePathOrUri) {
        return false;
    }
    let filepath = filePathOrUri;
    try {
        filepath = (0, url_1.fileURLToPath)(filePathOrUri);
    }
    catch { }
    if (path_1.default.isAbsolute(filepath)) {
        const dir = path_1.default.dirname(filepath).split(/\/|\\/).at(-1) ?? "";
        const basename = path_1.default.basename(filepath);
        filepath = `${dir ? dir + "/" : ""}${basename}`;
    }
    if (!filepath) {
        return false;
    }
    return exports.defaultFileAndFolderSecurityIgnores.ignores(filepath);
}
function throwIfFileIsSecurityConcern(filepath) {
    if (isSecurityConcern(filepath)) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.FileIsSecurityConcern, `Reading or Editing ${filepath} is not allowed because it is a security concern. Do not attempt to read or edit this file in any way.`);
    }
}
function gitIgArrayFromFile(file) {
    return file
        .split(/\r?\n/) // Split on new line
        .map((l) => l.trim()) // Remove whitespace
        .filter((l) => !/^#|^$/.test(l)); // Remove empty lines
}
//# sourceMappingURL=ignore.js.map