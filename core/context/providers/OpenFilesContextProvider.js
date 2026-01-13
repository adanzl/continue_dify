"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ignore_js_1 = require("../../indexing/ignore.js");
const uri_js_1 = require("../../util/uri.js");
const index_js_1 = require("../index.js");
class OpenFilesContextProvider extends index_js_1.BaseContextProvider {
    async getContextItems(query, extras) {
        const ide = extras.ide;
        const openFiles = this.options?.onlyPinned
            ? await ide.getPinnedFiles()
            : await ide.getOpenFiles();
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        return await Promise.all(openFiles.map(async (filepath) => {
            const { relativePathOrBasename, last2Parts, baseName } = (0, uri_js_1.getUriDescription)(filepath, workspaceDirs);
            if ((0, ignore_js_1.isSecurityConcern)(filepath)) {
                return {
                    description: last2Parts,
                    content: "Content redacted, this file cannot be viewed for security reasons",
                    name: baseName,
                    uri: {
                        type: "file",
                        value: filepath,
                    },
                };
            }
            const content = await ide.readFile(filepath);
            return {
                description: last2Parts,
                content: `\`\`\`${relativePathOrBasename}\n${content}\n\`\`\``,
                name: baseName,
                uri: {
                    type: "file",
                    value: filepath,
                },
            };
        }));
    }
}
OpenFilesContextProvider.description = {
    title: "open",
    displayTitle: "Open Files",
    description: "Reference the current open files",
    type: "normal",
    renderInlineAs: "",
};
exports.default = OpenFilesContextProvider;
//# sourceMappingURL=OpenFilesContextProvider.js.map