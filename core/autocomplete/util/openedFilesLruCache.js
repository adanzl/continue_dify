"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prevFilepaths = exports.openedFilesLruCache = void 0;
const quick_lru_1 = __importDefault(require("quick-lru"));
// maximum number of open files that can be cached
const MAX_NUM_OPEN_CONTEXT_FILES = 20;
// stores which files are currently open in the IDE, in viewing order
exports.openedFilesLruCache = new quick_lru_1.default({
    maxSize: MAX_NUM_OPEN_CONTEXT_FILES,
});
// used in core/core.ts to handle removals from the cache
exports.prevFilepaths = {
    filepaths: [],
};
//# sourceMappingURL=openedFilesLruCache.js.map