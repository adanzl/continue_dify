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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFileWithinFolder = exports.DEFAULT_CONFIG_TS_CONTENTS = void 0;
exports.setConfigFilePermissions = setConfigFilePermissions;
exports.getChromiumPath = getChromiumPath;
exports.getContinueUtilsPath = getContinueUtilsPath;
exports.getGlobalContinueIgnorePath = getGlobalContinueIgnorePath;
exports.getContinueGlobalPath = getContinueGlobalPath;
exports.getSessionsFolderPath = getSessionsFolderPath;
exports.getIndexFolderPath = getIndexFolderPath;
exports.getGlobalContextFilePath = getGlobalContextFilePath;
exports.getSharedConfigFilePath = getSharedConfigFilePath;
exports.getSessionFilePath = getSessionFilePath;
exports.getSessionsListPath = getSessionsListPath;
exports.getConfigJsonPath = getConfigJsonPath;
exports.getConfigYamlPath = getConfigYamlPath;
exports.getPrimaryConfigFilePath = getPrimaryConfigFilePath;
exports.getConfigTsPath = getConfigTsPath;
exports.getConfigJsPath = getConfigJsPath;
exports.getTsConfigPath = getTsConfigPath;
exports.getContinueRcPath = getContinueRcPath;
exports.getDevDataSqlitePath = getDevDataSqlitePath;
exports.getDevDataFilePath = getDevDataFilePath;
exports.editConfigFile = editConfigFile;
exports.migrate = migrate;
exports.getIndexSqlitePath = getIndexSqlitePath;
exports.getLanceDbPath = getLanceDbPath;
exports.getTabAutocompleteCacheSqlitePath = getTabAutocompleteCacheSqlitePath;
exports.getDocsSqlitePath = getDocsSqlitePath;
exports.getRemoteConfigsFolderPath = getRemoteConfigsFolderPath;
exports.getPathToRemoteConfig = getPathToRemoteConfig;
exports.getConfigJsonPathForRemote = getConfigJsonPathForRemote;
exports.getConfigJsPathForRemote = getConfigJsPathForRemote;
exports.getContinueDotEnv = getContinueDotEnv;
exports.getLogsDirPath = getLogsDirPath;
exports.getCoreLogsPath = getCoreLogsPath;
exports.getPromptLogsPath = getPromptLogsPath;
exports.getGlobalFolderWithName = getGlobalFolderWithName;
exports.getGlobalPromptsPath = getGlobalPromptsPath;
exports.readAllGlobalPromptFiles = readAllGlobalPromptFiles;
exports.getRepoMapFilePath = getRepoMapFilePath;
exports.getEsbuildBinaryPath = getEsbuildBinaryPath;
exports.migrateV1DevDataFiles = migrateV1DevDataFiles;
exports.getLocalEnvironmentDotFilePath = getLocalEnvironmentDotFilePath;
exports.getStagingEnvironmentDotFilePath = getStagingEnvironmentDotFilePath;
exports.getDiffsDirectoryPath = getDiffsDirectoryPath;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const URI = __importStar(require("uri-js"));
const YAML = __importStar(require("yaml"));
const JSONC = __importStar(require("comment-json"));
const dotenv_1 = __importDefault(require("dotenv"));
const default_1 = require("../config/default");
const types_1 = __importDefault(require("../config/types"));
dotenv_1.default.config();
function setConfigFilePermissions(filePath) {
    try {
        if (os.platform() !== "win32") {
            fs.chmodSync(filePath, 0o600);
        }
    }
    catch (error) {
        console.warn(`Failed to set permissions on ${filePath}:`, error);
    }
}
const CONTINUE_GLOBAL_DIR = (() => {
    const configPath = process.env.CONTINUE_GLOBAL_DIR;
    if (configPath) {
        // Convert relative path to absolute paths based on current working directory
        return path.isAbsolute(configPath)
            ? configPath
            : path.resolve(process.cwd(), configPath);
    }
    return path.join(os.homedir(), ".continue");
})();
// export const DEFAULT_CONFIG_TS_CONTENTS = `import { Config } from "./types"\n\nexport function modifyConfig(config: Config): Config {
//   return config;
// }`;
exports.DEFAULT_CONFIG_TS_CONTENTS = `export function modifyConfig(config: Config): Config {
  return config;
}`;
function getChromiumPath() {
    return path.join(getContinueUtilsPath(), ".chromium-browser-snapshots");
}
function getContinueUtilsPath() {
    const utilsPath = path.join(getContinueGlobalPath(), ".utils");
    if (!fs.existsSync(utilsPath)) {
        fs.mkdirSync(utilsPath);
    }
    return utilsPath;
}
function getGlobalContinueIgnorePath() {
    const continueIgnorePath = path.join(getContinueGlobalPath(), ".continueignore");
    if (!fs.existsSync(continueIgnorePath)) {
        fs.writeFileSync(continueIgnorePath, "");
    }
    return continueIgnorePath;
}
function getContinueGlobalPath() {
    // This is ~/.continue on mac/linux
    const continuePath = CONTINUE_GLOBAL_DIR;
    if (!fs.existsSync(continuePath)) {
        fs.mkdirSync(continuePath);
    }
    return continuePath;
}
function getSessionsFolderPath() {
    const sessionsPath = path.join(getContinueGlobalPath(), "sessions");
    if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath);
    }
    return sessionsPath;
}
function getIndexFolderPath() {
    const indexPath = path.join(getContinueGlobalPath(), "index");
    if (!fs.existsSync(indexPath)) {
        fs.mkdirSync(indexPath);
    }
    return indexPath;
}
function getGlobalContextFilePath() {
    return path.join(getIndexFolderPath(), "globalContext.json");
}
function getSharedConfigFilePath() {
    return path.join(getContinueGlobalPath(), "sharedConfig.json");
}
function getSessionFilePath(sessionId) {
    return path.join(getSessionsFolderPath(), `${sessionId}.json`);
}
function getSessionsListPath() {
    const filepath = path.join(getSessionsFolderPath(), "sessions.json");
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, JSON.stringify([]));
    }
    return filepath;
}
function getConfigJsonPath() {
    const p = path.join(getContinueGlobalPath(), "config.json");
    return p;
}
function getConfigYamlPath(ideType) {
    const p = path.join(getContinueGlobalPath(), "config.yaml");
    if (!fs.existsSync(p) && !fs.existsSync(getConfigJsonPath())) {
        if (ideType === "jetbrains") {
            // https://github.com/continuedev/continue/pull/7224
            // This was here because we had different context provider support between jetbrains and vs code
            // Leaving so we could differentiate later but for now configs are the same between IDEs
            fs.writeFileSync(p, YAML.stringify(default_1.defaultConfig));
        }
        else {
            fs.writeFileSync(p, YAML.stringify(default_1.defaultConfig));
        }
        setConfigFilePermissions(p);
    }
    return p;
}
function getPrimaryConfigFilePath() {
    const configYamlPath = getConfigYamlPath();
    if (fs.existsSync(configYamlPath)) {
        return configYamlPath;
    }
    return getConfigJsonPath();
}
function getConfigTsPath() {
    const p = path.join(getContinueGlobalPath(), "config.ts");
    if (!fs.existsSync(p)) {
        fs.writeFileSync(p, exports.DEFAULT_CONFIG_TS_CONTENTS);
    }
    const typesPath = path.join(getContinueGlobalPath(), "types");
    if (!fs.existsSync(typesPath)) {
        fs.mkdirSync(typesPath);
    }
    const corePath = path.join(typesPath, "core");
    if (!fs.existsSync(corePath)) {
        fs.mkdirSync(corePath);
    }
    const packageJsonPath = path.join(getContinueGlobalPath(), "package.json");
    if (!fs.existsSync(packageJsonPath)) {
        fs.writeFileSync(packageJsonPath, JSON.stringify({
            name: "continue-config",
            version: "1.0.0",
            description: "My Continue Configuration",
            main: "config.js",
        }));
    }
    fs.writeFileSync(path.join(corePath, "index.d.ts"), types_1.default);
    return p;
}
function getConfigJsPath() {
    // Do not create automatically
    return path.join(getContinueGlobalPath(), "out", "config.js");
}
function getTsConfigPath() {
    const tsConfigPath = path.join(getContinueGlobalPath(), "tsconfig.json");
    if (!fs.existsSync(tsConfigPath)) {
        fs.writeFileSync(tsConfigPath, JSON.stringify({
            compilerOptions: {
                target: "ESNext",
                useDefineForClassFields: true,
                lib: ["DOM", "DOM.Iterable", "ESNext"],
                allowJs: true,
                skipLibCheck: true,
                esModuleInterop: false,
                allowSyntheticDefaultImports: true,
                strict: true,
                forceConsistentCasingInFileNames: true,
                module: "System",
                moduleResolution: "Node",
                noEmit: false,
                noEmitOnError: false,
                outFile: "./out/config.js",
                typeRoots: ["./node_modules/@types", "./types"],
            },
            include: ["./config.ts"],
        }, null, 2));
    }
    return tsConfigPath;
}
function getContinueRcPath() {
    // Disable indexing of the config folder to prevent infinite loops
    const continuercPath = path.join(getContinueGlobalPath(), ".continuerc.json");
    if (!fs.existsSync(continuercPath)) {
        fs.writeFileSync(continuercPath, JSON.stringify({
            disableIndexing: true,
        }, null, 2));
    }
    return continuercPath;
}
function getDevDataPath() {
    const sPath = path.join(getContinueGlobalPath(), "dev_data");
    if (!fs.existsSync(sPath)) {
        fs.mkdirSync(sPath);
    }
    return sPath;
}
function getDevDataSqlitePath() {
    return path.join(getDevDataPath(), "devdata.sqlite");
}
function getDevDataFilePath(eventName, schema) {
    const versionPath = path.join(getDevDataPath(), schema);
    if (!fs.existsSync(versionPath)) {
        fs.mkdirSync(versionPath);
    }
    return path.join(versionPath, `${String(eventName)}.jsonl`);
}
function editConfigJson(callback) {
    const config = fs.readFileSync(getConfigJsonPath(), "utf8");
    let configJson = JSONC.parse(config);
    // Check if it's an object
    if (typeof configJson === "object" && configJson !== null) {
        configJson = callback(configJson);
        fs.writeFileSync(getConfigJsonPath(), JSONC.stringify(configJson, null, 2));
    }
    else {
        console.warn("config.json is not a valid object");
    }
}
function editConfigYaml(callback) {
    const configPath = getConfigYamlPath();
    const config = fs.readFileSync(configPath, "utf8");
    let configYaml = YAML.parse(config);
    // Check if it's an object
    if (typeof configYaml === "object" && configYaml !== null) {
        configYaml = callback(configYaml);
        fs.writeFileSync(configPath, YAML.stringify(configYaml));
        setConfigFilePermissions(configPath);
    }
    else {
        console.warn("config.yaml is not a valid object");
    }
}
function editConfigFile(configJsonCallback, configYamlCallback) {
    if (fs.existsSync(getConfigYamlPath())) {
        editConfigYaml(configYamlCallback);
    }
    else if (fs.existsSync(getConfigJsonPath())) {
        editConfigJson(configJsonCallback);
    }
}
function getMigrationsFolderPath() {
    const migrationsPath = path.join(getContinueGlobalPath(), ".migrations");
    if (!fs.existsSync(migrationsPath)) {
        fs.mkdirSync(migrationsPath);
    }
    return migrationsPath;
}
async function migrate(id, callback, onAlreadyComplete) {
    if (process.env.NODE_ENV === "test") {
        return await Promise.resolve(callback());
    }
    const migrationsPath = getMigrationsFolderPath();
    const migrationPath = path.join(migrationsPath, id);
    if (!fs.existsSync(migrationPath)) {
        try {
            console.log(`Running migration: ${id}`);
            fs.writeFileSync(migrationPath, "");
            await Promise.resolve(callback());
        }
        catch (e) {
            console.warn(`Migration ${id} failed`, e);
        }
    }
    else if (onAlreadyComplete) {
        onAlreadyComplete();
    }
}
function getIndexSqlitePath() {
    return path.join(getIndexFolderPath(), "index.sqlite");
}
function getLanceDbPath() {
    return path.join(getIndexFolderPath(), "lancedb");
}
function getTabAutocompleteCacheSqlitePath() {
    return path.join(getIndexFolderPath(), "autocompleteCache.sqlite");
}
function getDocsSqlitePath() {
    return path.join(getIndexFolderPath(), "docs.sqlite");
}
function getRemoteConfigsFolderPath() {
    const dir = path.join(getContinueGlobalPath(), ".configs");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return dir;
}
function getPathToRemoteConfig(remoteConfigServerUrl) {
    let url = undefined;
    try {
        url =
            typeof remoteConfigServerUrl !== "string" || remoteConfigServerUrl === ""
                ? undefined
                : new URL(remoteConfigServerUrl);
    }
    catch (e) { }
    const dir = path.join(getRemoteConfigsFolderPath(), url?.hostname ?? "None");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return dir;
}
function getConfigJsonPathForRemote(remoteConfigServerUrl) {
    return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.json");
}
function getConfigJsPathForRemote(remoteConfigServerUrl) {
    return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.js");
}
function getContinueDotEnv() {
    const filepath = path.join(getContinueGlobalPath(), ".env");
    if (fs.existsSync(filepath)) {
        return dotenv_1.default.parse(fs.readFileSync(filepath));
    }
    return {};
}
function getLogsDirPath() {
    const logsPath = path.join(getContinueGlobalPath(), "logs");
    if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath);
    }
    return logsPath;
}
function getCoreLogsPath() {
    return path.join(getLogsDirPath(), "core.log");
}
function getPromptLogsPath() {
    return path.join(getLogsDirPath(), "prompt.log");
}
function getGlobalFolderWithName(name) {
    return path.join(getContinueGlobalPath(), name);
}
function getGlobalPromptsPath() {
    return getGlobalFolderWithName("prompts");
}
function readAllGlobalPromptFiles(folderPath = getGlobalPromptsPath()) {
    if (!fs.existsSync(folderPath)) {
        return [];
    }
    const files = fs.readdirSync(folderPath);
    const promptFiles = [];
    files.forEach((file) => {
        const filepath = path.join(folderPath, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            const nestedPromptFiles = readAllGlobalPromptFiles(filepath);
            promptFiles.push(...nestedPromptFiles);
        }
        else if (file.endsWith(".prompt")) {
            const content = fs.readFileSync(filepath, "utf8");
            promptFiles.push({ path: filepath, content });
        }
    });
    return promptFiles;
}
function getRepoMapFilePath() {
    return path.join(getContinueUtilsPath(), "repo_map.txt");
}
function getEsbuildBinaryPath() {
    return path.join(getContinueUtilsPath(), "esbuild");
}
function migrateV1DevDataFiles() {
    const devDataPath = getDevDataPath();
    function moveToV1FolderIfExists(oldFileName, newFileName) {
        const oldFilePath = path.join(devDataPath, `${oldFileName}.jsonl`);
        if (fs.existsSync(oldFilePath)) {
            const newFilePath = getDevDataFilePath(newFileName, "0.1.0");
            if (!fs.existsSync(newFilePath)) {
                fs.copyFileSync(oldFilePath, newFilePath);
                fs.unlinkSync(oldFilePath);
            }
        }
    }
    moveToV1FolderIfExists("tokens_generated", "tokensGenerated");
    moveToV1FolderIfExists("chat", "chatFeedback");
    moveToV1FolderIfExists("quickEdit", "quickEdit");
    moveToV1FolderIfExists("autocomplete", "autocomplete");
}
function getLocalEnvironmentDotFilePath() {
    return path.join(getContinueGlobalPath(), ".local");
}
function getStagingEnvironmentDotFilePath() {
    return path.join(getContinueGlobalPath(), ".staging");
}
function getDiffsDirectoryPath() {
    const diffsPath = path.join(getContinueGlobalPath(), ".diffs"); // .replace(/^C:/, "c:"); ??
    if (!fs.existsSync(diffsPath)) {
        fs.mkdirSync(diffsPath, {
            recursive: true,
        });
    }
    return diffsPath;
}
const isFileWithinFolder = (fileUri, folderPath) => {
    try {
        if (!fileUri || !folderPath) {
            return false;
        }
        const fileUriParsed = URI.parse(fileUri);
        const fileScheme = fileUriParsed.scheme || "file";
        let filePath = fileUriParsed.path || "";
        filePath = decodeURIComponent(filePath);
        let folderWithScheme = folderPath;
        if (!folderPath.includes("://")) {
            folderWithScheme = `${fileScheme}://${folderPath.startsWith("/") ? "" : "/"}${folderPath}`;
        }
        const folderUriParsed = URI.parse(folderWithScheme);
        let folderPathClean = folderUriParsed.path || "";
        folderPathClean = decodeURIComponent(folderPathClean);
        filePath = filePath.replace(/\/$/, "");
        folderPathClean = folderPathClean.replace(/\/$/, "");
        return (filePath === folderPathClean || filePath.startsWith(`${folderPathClean}/`));
    }
    catch (error) {
        console.error("Error in isFileWithinFolder:", error);
        return false;
    }
};
exports.isFileWithinFolder = isFileWithinFolder;
//# sourceMappingURL=paths.js.map