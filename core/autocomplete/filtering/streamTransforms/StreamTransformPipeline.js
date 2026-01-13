"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamTransformPipeline = void 0;
const util_1 = require("../../../diff/util");
const charStream_1 = require("./charStream");
const lineStream_1 = require("./lineStream");
const STOP_AT_PATTERNS = ["diff --git"];
class StreamTransformPipeline {
    async *transform(generator, prefix, suffix, multiline, stopTokens, fullStop, helper) {
        let charGenerator = generator;
        charGenerator = (0, charStream_1.stopAtStopTokens)(generator, [
            ...stopTokens,
            ...STOP_AT_PATTERNS,
        ]);
        charGenerator = (0, charStream_1.stopAtStartOf)(charGenerator, suffix);
        for (const charFilter of helper.lang.charFilters ?? []) {
            charGenerator = charFilter({
                chars: charGenerator,
                prefix,
                suffix,
                filepath: helper.filepath,
                multiline,
            });
        }
        let lineGenerator = (0, util_1.streamLines)(charGenerator);
        lineGenerator = (0, lineStream_1.stopAtLines)(lineGenerator, fullStop);
        const lineBelowCursor = this.getLineBelowCursor(helper);
        if (lineBelowCursor.trim() !== "") {
            lineGenerator = (0, lineStream_1.stopAtLinesExact)(lineGenerator, fullStop, [
                lineBelowCursor,
            ]);
        }
        lineGenerator = (0, lineStream_1.stopAtRepeatingLines)(lineGenerator, fullStop);
        lineGenerator = (0, lineStream_1.avoidEmptyComments)(lineGenerator, helper.lang.singleLineComment);
        lineGenerator = (0, lineStream_1.avoidPathLine)(lineGenerator, helper.lang.singleLineComment);
        lineGenerator = (0, lineStream_1.skipPrefixes)(lineGenerator);
        lineGenerator = (0, lineStream_1.noDoubleNewLine)(lineGenerator);
        for (const lineFilter of helper.lang.lineFilters ?? []) {
            lineGenerator = lineFilter({ lines: lineGenerator, fullStop });
        }
        lineGenerator = (0, lineStream_1.stopAtSimilarLine)(lineGenerator, this.getLineBelowCursor(helper), fullStop);
        const timeoutValue = helper.options.modelTimeout;
        lineGenerator = (0, lineStream_1.showWhateverWeHaveAtXMs)(lineGenerator, timeoutValue);
        const finalGenerator = (0, lineStream_1.streamWithNewLines)(lineGenerator);
        for await (const update of finalGenerator) {
            yield update;
        }
    }
    getLineBelowCursor(helper) {
        let lineBelowCursor = "";
        let i = 1;
        while (lineBelowCursor.trim() === "" &&
            helper.pos.line + i <= helper.fileLines.length - 1) {
            lineBelowCursor =
                helper.fileLines[Math.min(helper.pos.line + i, helper.fileLines.length - 1)];
            i++;
        }
        return lineBelowCursor;
    }
}
exports.StreamTransformPipeline = StreamTransformPipeline;
//# sourceMappingURL=StreamTransformPipeline.js.map