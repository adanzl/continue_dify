"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUrlContentTool = void 0;
const builtIn_1 = require("../builtIn");
exports.fetchUrlContentTool = {
    type: "function",
    displayTitle: "Read URL",
    wouldLikeTo: "fetch {{{ url }}}",
    isCurrently: "fetching {{{ url }}}",
    hasAlready: "fetched {{{ url }}}",
    readonly: true,
    isInstant: true,
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    function: {
        name: builtIn_1.BuiltInToolNames.FetchUrlContent,
        description: "Can be used to view the contents of a website using a URL. Do NOT use this for files.",
        parameters: {
            type: "object",
            required: ["url"],
            properties: {
                url: {
                    type: "string",
                    description: "The URL to read",
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithPermission",
    systemMessageDescription: {
        prefix: `To fetch the content of a URL, use the ${builtIn_1.BuiltInToolNames.FetchUrlContent} tool. For example, to read the contents of a webpage, you might respond with:`,
        exampleArgs: [["url", "https://example.com"]],
    },
    toolCallIcon: "GlobeAltIcon",
};
//# sourceMappingURL=fetchUrlContent.js.map