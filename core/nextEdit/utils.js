"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNextEditTest = isNextEditTest;
exports.isWhitespaceOnlyDeletion = isWhitespaceOnlyDeletion;
exports.convertNextEditModelNameToEnum = convertNextEditModelNameToEnum;
const constants_1 = require("../llm/constants");
function isNextEditTest() {
    const enabled = process.env.NEXT_EDIT_TEST_ENABLED;
    if (enabled === "false") {
        return false;
    }
    if (enabled === "true") {
        return true;
    }
    return false;
}
function isWhitespaceOnlyDeletion(diffLines) {
    return diffLines.every((diff) => diff.type === "old" &&
        (diff.line.trim() === "" || /^\s+$/.test(diff.line)));
}
function convertNextEditModelNameToEnum(modelName) {
    const nextEditModels = Object.values(constants_1.NEXT_EDIT_MODELS);
    return nextEditModels.find((model) => modelName.includes(model));
}
//# sourceMappingURL=utils.js.map