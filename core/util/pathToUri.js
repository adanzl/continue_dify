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
exports.localPathToUri = localPathToUri;
exports.localPathOrUriToPath = localPathOrUriToPath;
const url_1 = require("url");
const URI = __importStar(require("uri-js"));
// CAN ONLY BE USED IN CORE
// Converts a local path to a file:/// URI
function localPathToUri(path) {
    // This may incidentally solve bugs, but it is primarily here to warn us if we accidentally try to double-convert. It doesn't handle other URI schemes.
    if (path.startsWith("file://")) {
        console.warn("localPathToUri: path already starts with file://");
        return path;
    }
    const url = (0, url_1.pathToFileURL)(path);
    return URI.normalize(url.toString());
}
function localPathOrUriToPath(localPathOrUri) {
    try {
        return (0, url_1.fileURLToPath)(localPathOrUri);
    }
    catch (e) {
        // console.log("Received local filepath", localPathOrUri);
        return localPathOrUri;
    }
}
//# sourceMappingURL=pathToUri.js.map