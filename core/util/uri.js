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
exports.pathToUriPathSegment = pathToUriPathSegment;
exports.getCleanUriPath = getCleanUriPath;
exports.findUriInDirs = findUriInDirs;
exports.getUriPathBasename = getUriPathBasename;
exports.getFileExtensionFromBasename = getFileExtensionFromBasename;
exports.getUriFileExtension = getUriFileExtension;
exports.getLastNUriRelativePathParts = getLastNUriRelativePathParts;
exports.joinPathsToUri = joinPathsToUri;
exports.joinEncodedUriPathSegmentToUri = joinEncodedUriPathSegmentToUri;
exports.getShortestUniqueRelativeUriPaths = getShortestUniqueRelativeUriPaths;
exports.getLastNPathParts = getLastNPathParts;
exports.getUriDescription = getUriDescription;
const URI = __importStar(require("uri-js"));
/** Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
   e.g. \path\to\folder\ -> path/to/folder
        \this\is\afile.ts -> this/is/afile.ts
        is/already/clean -> is/already/clean
  **/
function pathToUriPathSegment(path) {
    let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
    clean = clean.replace(/^\//, ""); // remove start slash
    clean = clean.replace(/\/$/, ""); // remove end slash
    return clean
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}
function getCleanUriPath(uri) {
    const path = URI.parse(uri).path ?? "";
    let clean = path.replace(/^\//, ""); // remove start slash
    clean = clean.replace(/\/$/, ""); // remove end slash
    return clean;
}
function findUriInDirs(uri, dirUriCandidates) {
    const uriComps = URI.parse(uri);
    if (!uriComps.scheme) {
        throw new Error(`Invalid uri: ${uri}`);
    }
    const uriPathParts = getCleanUriPath(uri).split("/");
    for (const dir of dirUriCandidates) {
        const dirComps = URI.parse(dir);
        if (!dirComps.scheme) {
            throw new Error(`Invalid uri: ${dir}`);
        }
        if (uriComps.scheme !== dirComps.scheme) {
            continue;
        }
        // Can't just use startsWith because e.g.
        // file:///folder/file is not within file:///fold
        // At this point we break the path up and check if each dir path part matches
        const dirPathParts = getCleanUriPath(dir).split("/");
        if (uriPathParts.length < dirPathParts.length) {
            continue;
        }
        let allDirPartsMatch = true;
        for (let i = 0; i < dirPathParts.length; i++) {
            if (dirPathParts[i] !== uriPathParts[i]) {
                allDirPartsMatch = false;
            }
        }
        if (allDirPartsMatch) {
            const relativePath = uriPathParts
                .slice(dirPathParts.length)
                .map(decodeURIComponent)
                .join("/");
            return {
                uri,
                relativePathOrBasename: relativePath,
                foundInDir: dir,
            };
        }
    }
    // Not found
    return {
        uri,
        relativePathOrBasename: getUriPathBasename(uri),
        foundInDir: null,
    };
}
/*
  Returns just the file or folder name of a URI
*/
function getUriPathBasename(uri) {
    const path = getCleanUriPath(uri);
    const basename = path.split("/").pop() || "";
    return decodeURIComponent(basename);
}
function getFileExtensionFromBasename(basename) {
    const parts = basename.split(".");
    if (parts.length < 2) {
        return "";
    }
    return (parts.slice(-1)[0] ?? "").toLowerCase();
}
/*
  Returns the file extension of a URI
*/
function getUriFileExtension(uri) {
    const baseName = getUriPathBasename(uri);
    return getFileExtensionFromBasename(baseName);
}
function getLastNUriRelativePathParts(dirUriCandidates, uri, n) {
    const { relativePathOrBasename } = findUriInDirs(uri, dirUriCandidates);
    return getLastNPathParts(relativePathOrBasename, n);
}
function joinPathsToUri(uri, ...pathSegments) {
    let baseUri = uri;
    if (baseUri.at(-1) !== "/") {
        baseUri += "/";
    }
    const segments = pathSegments.map((segment) => pathToUriPathSegment(segment));
    return URI.resolve(baseUri, segments.join("/"));
}
function joinEncodedUriPathSegmentToUri(uri, pathSegment) {
    let baseUri = uri;
    if (baseUri.at(-1) !== "/") {
        baseUri += "/";
    }
    return URI.resolve(baseUri, pathSegment);
}
function getShortestUniqueRelativeUriPaths(uris, dirUriCandidates) {
    // Split all URIs into segments and count occurrences of each suffix combination
    const segmentCombinationsMap = new Map();
    const segmentsInfo = uris.map((uri) => {
        const { relativePathOrBasename } = findUriInDirs(uri, dirUriCandidates);
        const segments = relativePathOrBasename.split("/");
        const suffixes = [];
        // Generate all possible suffix combinations, starting from the shortest (basename)
        for (let i = segments.length - 1; i >= 0; i--) {
            const suffix = segments.slice(i).join("/");
            suffixes.push(suffix); // Now pushing in order from shortest to longest
            // Count occurrences of each suffix
            segmentCombinationsMap.set(suffix, (segmentCombinationsMap.get(suffix) || 0) + 1);
        }
        return { uri, segments, suffixes, relativePathOrBasename };
    });
    // Find shortest unique path for each URI
    return segmentsInfo.map(({ uri, suffixes, relativePathOrBasename }) => {
        // Since suffixes are now ordered from shortest to longest,
        // the first unique one we find will be the shortest
        const uniquePath = suffixes.find((suffix) => segmentCombinationsMap.get(suffix) === 1) ??
            relativePathOrBasename; // fallback to full path if no unique suffix found
        return { uri, uniquePath };
    });
}
// Only used when working with system paths and relative paths
// Since doesn't account for URI segements before workspace
function getLastNPathParts(filepath, n) {
    if (n <= 0) {
        return "";
    }
    return filepath.split(/[\\/]/).slice(-n).join("/");
}
function getUriDescription(uri, dirUriCandidates) {
    const { relativePathOrBasename, foundInDir } = findUriInDirs(uri, dirUriCandidates);
    const baseName = getUriPathBasename(uri);
    const extension = getFileExtensionFromBasename(baseName);
    const last2Parts = getLastNUriRelativePathParts(dirUriCandidates, uri, 2);
    return {
        uri,
        relativePathOrBasename,
        foundInDir,
        last2Parts,
        baseName,
        extension,
    };
}
//# sourceMappingURL=uri.js.map