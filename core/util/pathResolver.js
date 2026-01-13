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
exports.resolveInputPath = resolveInputPath;
const node_url_1 = require("node:url");
const path = __importStar(require("path"));
const untildify_1 = __importDefault(require("untildify"));
const ideUtils_1 = require("./ideUtils");
const uri_1 = require("./uri");
/**
 * Checks if a URI is within any of the workspace directories
 * Also verifies the file actually exists, matching the behavior of resolveRelativePathInDir
 */
async function isUriWithinWorkspace(ide, uri) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    const { foundInDir } = (0, uri_1.findUriInDirs)(uri, workspaceDirs);
    // Check both: within workspace path AND file exists
    if (foundInDir !== null) {
        return await ide.fileExists(uri);
    }
    return false;
}
async function resolveInputPath(ide, inputPath) {
    const trimmedPath = inputPath.trim();
    // Handle file:// URIs
    if (trimmedPath.startsWith("file://")) {
        const displayPath = (0, node_url_1.fileURLToPath)(trimmedPath);
        const isWithinWorkspace = await isUriWithinWorkspace(ide, trimmedPath);
        return {
            uri: trimmedPath,
            displayPath,
            isAbsolute: true,
            isWithinWorkspace,
        };
    }
    // Expand tilde paths (handles ~/ and ~username/)
    const expandedPath = (0, untildify_1.default)(trimmedPath);
    // Check if it's an absolute path (including Windows paths)
    const isAbsolute = path.isAbsolute(expandedPath) ||
        // Windows network paths
        expandedPath.startsWith("\\\\") ||
        // Windows drive letters
        /^[a-zA-Z]:/.test(expandedPath);
    if (isAbsolute) {
        // Convert to file:// URI format
        const uri = (0, node_url_1.pathToFileURL)(expandedPath).href;
        const isWithinWorkspace = await isUriWithinWorkspace(ide, uri);
        return {
            uri,
            displayPath: expandedPath,
            isAbsolute: true,
            isWithinWorkspace,
        };
    }
    // Handle relative paths...
    const workspaceUri = await (0, ideUtils_1.resolveRelativePathInDir)(expandedPath, ide);
    if (workspaceUri) {
        return {
            uri: workspaceUri,
            displayPath: expandedPath,
            isAbsolute: false,
            isWithinWorkspace: true,
        };
    }
    return null;
}
//# sourceMappingURL=pathResolver.js.map