"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceContinueIgArray = exports.getGlobalContinueIgArray = void 0;
const fs_1 = __importDefault(require("fs"));
const paths_1 = require("../util/paths");
const ignore_1 = require("./ignore");
const getGlobalContinueIgArray = () => {
    const contents = fs_1.default.readFileSync((0, paths_1.getGlobalContinueIgnorePath)(), "utf8");
    return (0, ignore_1.gitIgArrayFromFile)(contents);
};
exports.getGlobalContinueIgArray = getGlobalContinueIgArray;
const getWorkspaceContinueIgArray = async (ide) => {
    const dirs = await ide.getWorkspaceDirs();
    return await dirs.reduce(async (accPromise, dir) => {
        const acc = await accPromise;
        try {
            const contents = await ide.readFile(`${dir}/.continueignore`);
            return [...acc, ...(0, ignore_1.gitIgArrayFromFile)(contents)];
        }
        catch (err) {
            console.error(err);
            return acc;
        }
    }, Promise.resolve([]));
};
exports.getWorkspaceContinueIgArray = getWorkspaceContinueIgArray;
//# sourceMappingURL=continueignore.js.map