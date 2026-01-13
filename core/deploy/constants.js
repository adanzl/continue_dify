"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constants = void 0;
exports.getTimestamp = getTimestamp;
exports.constants = {
    b: "1710787199603",
    c: "NfZFVegMpdyT3P5UmAggr7T7Hb6PlcbB",
};
function getTimestamp() {
    const x = Date.now().toString();
    const l = new Date().getMinutes();
    let j = Math.floor(l / 2) + 10;
    return x.slice(0, -2) + j.toString();
}
//# sourceMappingURL=constants.js.map