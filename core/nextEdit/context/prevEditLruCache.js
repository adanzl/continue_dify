"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrevEditsDescending = exports.setPrevEdit = exports.prevEditLruCache = void 0;
const quick_lru_1 = __importDefault(require("quick-lru"));
const maxPrevEdits = 5;
exports.prevEditLruCache = new quick_lru_1.default({
    maxSize: maxPrevEdits,
});
const setPrevEdit = (edit) => {
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const key = `${edit.fileUri}:${edit.timestamp}:${uniqueSuffix}`;
    exports.prevEditLruCache.set(key, edit);
};
exports.setPrevEdit = setPrevEdit;
const getPrevEditsDescending = () => {
    const edits = [];
    for (const [_, edit] of exports.prevEditLruCache.entriesDescending()) {
        if (edits.length >= maxPrevEdits) {
            break;
        }
        edits.push(edit);
    }
    return edits;
};
exports.getPrevEditsDescending = getPrevEditsDescending;
//# sourceMappingURL=prevEditLruCache.js.map