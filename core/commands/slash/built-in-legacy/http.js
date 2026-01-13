"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@continuedev/fetch");
const index_js_1 = require("../../../util/index.js");
const HttpSlashCommand = {
    name: "http",
    description: "Call an HTTP endpoint to serve response",
    run: async function* ({ ide, llm, input, params, fetch }) {
        const url = params?.url;
        if (!url) {
            throw new Error("URL is not defined in params");
        }
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                input: (0, index_js_1.removeQuotesAndEscapes)(input),
            }),
        });
        // Stream the response
        if (response.body === null) {
            throw new Error("Response body is null");
        }
        for await (const chunk of (0, fetch_1.streamResponse)(response)) {
            yield chunk;
        }
    },
};
exports.default = HttpSlashCommand;
//# sourceMappingURL=http.js.map