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
exports.getWorkspaceRcConfigs = getWorkspaceRcConfigs;
const JSONC = __importStar(require("comment-json"));
const uri_1 = require("../../util/uri");
async function getWorkspaceRcConfigs(ide) {
    try {
        const workspaces = await ide.getWorkspaceDirs();
        const rcFiles = await Promise.all(workspaces.map(async (dir) => {
            const ls = await ide.listDir(dir);
            const rcFiles = ls
                .filter((entry) => (entry[1] === 1 ||
                entry[1] === 64) &&
                entry[0].endsWith(".continuerc.json"))
                .map((entry) => (0, uri_1.joinPathsToUri)(dir, entry[0]));
            return await Promise.all(rcFiles.map(ide.readFile));
        }));
        return rcFiles
            .flat()
            .map((file) => JSONC.parse(file));
    }
    catch (e) {
        console.debug("Failed to load workspace configs: ", e);
        return [];
    }
}
//# sourceMappingURL=loadRcConfigs.js.map