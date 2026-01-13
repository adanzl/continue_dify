"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewSubdirectoryImpl = void 0;
const generateRepoMap_1 = __importDefault(require("../../util/generateRepoMap"));
const pathResolver_1 = require("../../util/pathResolver");
const errors_1 = require("../../util/errors");
const parseArgs_1 = require("../parseArgs");
const viewSubdirectoryImpl = async (args, extras) => {
    const directory_path = (0, parseArgs_1.getStringArg)(args, "directory_path");
    const resolvedPath = await (0, pathResolver_1.resolveInputPath)(extras.ide, directory_path);
    if (!resolvedPath) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.DirectoryNotFound, `Directory path "${directory_path}" does not exist or is not accessible.`);
    }
    // Check if the resolved path actually exists
    const exists = await extras.ide.fileExists(resolvedPath.uri);
    if (!exists) {
        throw new errors_1.ContinueError(errors_1.ContinueErrorReason.DirectoryNotFound, `Directory path "${directory_path}" does not exist or is not accessible.`);
    }
    const repoMap = await (0, generateRepoMap_1.default)(extras.llm, extras.ide, {
        dirUris: [resolvedPath.uri],
        outputRelativeUriPaths: true,
        includeSignatures: false,
    });
    return [
        {
            name: "Repo map",
            description: `Map of ${resolvedPath.displayPath}`,
            content: repoMap,
        },
    ];
};
exports.viewSubdirectoryImpl = viewSubdirectoryImpl;
//# sourceMappingURL=viewSubdirectory.js.map