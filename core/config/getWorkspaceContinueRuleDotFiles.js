"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PROMPT_DOT_FILE = void 0;
exports.getWorkspaceContinueRuleDotFiles = getWorkspaceContinueRuleDotFiles;
const uri_1 = require("../util/uri");
exports.SYSTEM_PROMPT_DOT_FILE = ".continuerules";
async function getWorkspaceContinueRuleDotFiles(ide) {
    const dirs = await ide.getWorkspaceDirs();
    const errors = [];
    const rules = [];
    for (const dir of dirs) {
        try {
            const dotFile = (0, uri_1.joinPathsToUri)(dir, exports.SYSTEM_PROMPT_DOT_FILE);
            const exists = await ide.fileExists(dotFile);
            if (exists) {
                const content = await ide.readFile(dotFile);
                rules.push({
                    rule: content,
                    sourceFile: dotFile,
                    source: ".continuerules",
                });
            }
        }
        catch (e) {
            errors.push({
                fatal: false,
                message: `Failed to load system prompt dot file from workspace ${dir}: ${e instanceof Error ? e.message : e}`,
            });
        }
    }
    return { rules, errors };
}
//# sourceMappingURL=getWorkspaceContinueRuleDotFiles.js.map