"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicateChunks = deduplicateChunks;
const index_1 = require("../../util/index");
function deduplicateChunks(chunks) {
    return (0, index_1.deduplicateArray)(chunks, (a, b) => {
        return (a.filepath === b.filepath &&
            a.startLine === b.startLine &&
            a.endLine === b.endLine);
    });
}
//# sourceMappingURL=util.js.map