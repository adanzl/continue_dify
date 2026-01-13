"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewRepoMapImpl = void 0;
const generateRepoMap_1 = __importDefault(require("../../util/generateRepoMap"));
const viewRepoMapImpl = async (args, extras) => {
    const repoMap = await (0, generateRepoMap_1.default)(extras.llm, extras.ide, {
        outputRelativeUriPaths: true,
        includeSignatures: true,
    });
    return [
        {
            name: "Repo map",
            description: "Overview of the repository structure",
            content: repoMap,
        },
    ];
};
exports.viewRepoMapImpl = viewRepoMapImpl;
//# sourceMappingURL=viewRepoMap.js.map