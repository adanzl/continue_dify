"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkDirCache = void 0;
exports.walkDirAsync = walkDirAsync;
exports.walkDir = walkDir;
exports.walkDirs = walkDirs;
exports.getIgnoreContext = getIgnoreContext;
const ignore_1 = __importDefault(require("ignore"));
const uri_1 = require("../util/uri");
const continueignore_1 = require("./continueignore");
const ignore_2 = require("./ignore");
const LIST_DIR_CACHE_TIME = 30000; // 30 seconds
const IGNORE_FILE_CACHE_TIME = 30000; // 30 seconds
class WalkDirCache {
    constructor() {
        this.dirListCache = new Map();
        this.dirIgnoreCache = new Map();
        // invalidateIgnore(uri: string) {
        //   this.dirIgnoreCache.delete(uri);
        // }
        // invalidateParent(uri: string) {
        //   const splitUri = fileUri.split("/");
        //   splitUri.pop();
        //   const parent = splitUri.join("/");
        //   this.dirListCache.delete(uri);
        // }
    }
    // The super safe approach for now
    invalidate() {
        this.dirListCache.clear();
        this.dirIgnoreCache.clear();
    }
}
exports.walkDirCache = new WalkDirCache(); // TODO - singleton approach better?
class DFSWalker {
    constructor(uri, ide, options) {
        this.uri = uri;
        this.ide = ide;
        this.options = options;
    }
    // walk is a depth-first search implementation
    async *walk() {
        const start = Date.now();
        let ignoreFileTime = 0;
        let ignoreTime = 0;
        let listDirTime = 0;
        let dirs = 0;
        let listDirCacheHits = 0;
        let ignoreCacheHits = 0;
        let section = Date.now();
        const defaultAndGlobalIgnores = (0, ignore_1.default)()
            .add(this.options.overrideDefaultIgnores ?? ignore_2.defaultIgnoreFileAndDir)
            .add((0, continueignore_1.getGlobalContinueIgArray)());
        ignoreFileTime += Date.now() - section;
        const rootContext = {
            walkableEntry: {
                name: "",
                relativeUriPath: "",
                uri: this.uri,
                type: 2,
                entry: ["", 2],
            },
            ignoreContexts: [],
        };
        const stack = [rootContext];
        for (let cur = stack.pop(); cur; cur = stack.pop()) {
            // Previous no caching approach:
            // const entries = await this.ide.listDir(cur.walkableEntry.uri);
            // const newIgnore = await getIgnoreContext(
            //   cur.walkableEntry.uri,
            //   entries,
            //   this.ide,
            //   defaultAndGlobalIgnores,
            // );
            // Only directories will be added to the stack
            dirs++;
            section = Date.now();
            let entries = [];
            const cachedListdir = exports.walkDirCache.dirListCache.get(cur.walkableEntry.uri);
            if (cachedListdir &&
                cachedListdir.time > Date.now() - LIST_DIR_CACHE_TIME) {
                entries = await cachedListdir.entries;
                listDirCacheHits++;
            }
            else {
                const promise = this.ide.listDir(cur.walkableEntry.uri);
                exports.walkDirCache.dirListCache.set(cur.walkableEntry.uri, {
                    time: Date.now(),
                    entries: promise,
                });
                entries = await promise;
            }
            listDirTime += Date.now() - section;
            section = Date.now();
            let newIgnore;
            const cachedIgnore = exports.walkDirCache.dirIgnoreCache.get(cur.walkableEntry.uri);
            if (cachedIgnore &&
                cachedIgnore.time > Date.now() - IGNORE_FILE_CACHE_TIME) {
                newIgnore = await cachedIgnore.ignore;
                ignoreCacheHits++;
            }
            else {
                const ignorePromise = getIgnoreContext(cur.walkableEntry.uri, entries, this.ide, defaultAndGlobalIgnores);
                exports.walkDirCache.dirIgnoreCache.set(cur.walkableEntry.uri, {
                    time: Date.now(),
                    ignore: ignorePromise,
                });
                newIgnore = await ignorePromise;
            }
            const ignoreContexts = [
                ...cur.ignoreContexts,
                {
                    ignore: newIgnore,
                    dirname: cur.walkableEntry.relativeUriPath,
                },
            ];
            ignoreFileTime += Date.now() - section;
            for (const entry of entries) {
                if (this.entryIsSymlink(entry)) {
                    // If called from the root, a symlink either links to a real file in this repository,
                    // and therefore will be walked OR it links to something outside of the repository and
                    // we do not want to index it
                    continue;
                }
                const walkableEntry = {
                    name: entry[0],
                    relativeUriPath: `${cur.walkableEntry.relativeUriPath}${cur.walkableEntry.relativeUriPath ? "/" : ""}${entry[0]}`,
                    uri: (0, uri_1.joinPathsToUri)(cur.walkableEntry.uri, entry[0]),
                    type: entry[1],
                    entry: entry,
                };
                let relPath = walkableEntry.relativeUriPath;
                if (this.entryIsDirectory(entry)) {
                    relPath = `${relPath}/`;
                }
                else {
                    if (this.options.include === "dirs") {
                        continue;
                    }
                }
                let shouldIgnore = false;
                for (const ig of ignoreContexts) {
                    if (shouldIgnore) {
                        continue;
                    }
                    // remove the directory name and path separator from the match path, unless this an ignore file
                    // in the root directory
                    const prefixLength = ig.dirname.length === 0 ? 0 : ig.dirname.length + 1;
                    // The ignore library expects a path relative to the ignore file location
                    const matchPath = relPath.substring(prefixLength);
                    section = Date.now();
                    if (ig.ignore.ignores(matchPath)) {
                        shouldIgnore = true;
                    }
                    ignoreTime += Date.now() - section;
                }
                if (shouldIgnore) {
                    continue;
                }
                if (this.entryIsDirectory(entry)) {
                    if (this.options.recursive) {
                        stack.push({
                            walkableEntry,
                            ignoreContexts,
                        });
                    }
                    if (this.options.include !== "files") {
                        // if yielding dirs or both, walker includes relative paths
                        const trailingSlash = this.options.include === "dirs" ? "" : "/";
                        if (this.options.returnRelativeUrisPaths) {
                            yield walkableEntry.relativeUriPath + trailingSlash;
                        }
                        else {
                            yield walkableEntry.uri + trailingSlash;
                        }
                    }
                }
                else if (this.options.include !== "dirs") {
                    if (this.options.returnRelativeUrisPaths) {
                        yield walkableEntry.relativeUriPath;
                    }
                    else {
                        yield walkableEntry.uri;
                    }
                }
            }
        }
        // console.log(
        //   `Walk Dir Result:\nSource: ${this.options.source ?? "unknown"}\nDir: ${this.uri}\nDuration: ${Date.now() - start}ms:\n\tList dir: ${listDirTime}ms (${listDirCacheHits}/${dirs} cache hits)\n\tIgnore files: ${ignoreFileTime}ms (${ignoreCacheHits}/${dirs} cache hits)\n\tIgnoring: ${ignoreTime}ms`,
        // );
    }
    entryIsDirectory(entry) {
        return entry[1] === 2;
    }
    entryIsSymlink(entry) {
        return entry[1] === 64;
    }
}
const defaultOptions = {
    include: "files",
    returnRelativeUrisPaths: false,
    recursive: true,
};
async function* walkDirAsync(path, ide, _optionOverrides) {
    const options = { ...defaultOptions, ..._optionOverrides };
    yield* new DFSWalker(path, ide, options).walk();
}
async function walkDir(uri, ide, _optionOverrides) {
    let urisOrRelativePaths = [];
    for await (const p of walkDirAsync(uri, ide, _optionOverrides)) {
        urisOrRelativePaths.push(p);
    }
    return urisOrRelativePaths;
}
async function walkDirs(ide, _optionOverrides, dirs) {
    const workspaceDirs = dirs ?? (await ide.getWorkspaceDirs());
    const results = await Promise.all(workspaceDirs.map((dir) => walkDir(dir, ide, _optionOverrides)));
    return results.flat();
}
async function getIgnoreContext(currentDir, currentDirEntries, ide, defaultAndGlobalIgnores) {
    const dirFiles = currentDirEntries
        .filter(([_, entryType]) => entryType === 1)
        .map(([name, _]) => name);
    // Find ignore files and get ignore arrays from their contexts
    // These are done separately so that .continueignore can override .gitignore
    const gitIgnoreFile = dirFiles.find((name) => name === ".gitignore");
    const continueIgnoreFile = dirFiles.find((name) => name === ".continueignore");
    const getGitIgnorePatterns = async () => {
        if (gitIgnoreFile) {
            const contents = await ide.readFile(`${currentDir}/.gitignore`);
            return (0, ignore_2.gitIgArrayFromFile)(contents);
        }
        return [];
    };
    const getContinueIgnorePatterns = async () => {
        if (continueIgnoreFile) {
            const contents = await ide.readFile(`${currentDir}/.continueignore`);
            return (0, ignore_2.gitIgArrayFromFile)(contents);
        }
        return [];
    };
    const ignoreArrays = await Promise.all([
        getGitIgnorePatterns(),
        getContinueIgnorePatterns(),
    ]);
    if (ignoreArrays[0].length === 0 && ignoreArrays[1].length === 0) {
        return defaultAndGlobalIgnores;
    }
    // Note precedence here!
    const ignoreContext = (0, ignore_1.default)()
        .add(ignoreArrays[0]) // gitignore
        .add(defaultAndGlobalIgnores) // default file/folder ignores followed by global .continueignore - this is combined for speed
        .add(ignoreArrays[1]); // local .continueignore
    return ignoreContext;
}
//# sourceMappingURL=walkDir.js.map