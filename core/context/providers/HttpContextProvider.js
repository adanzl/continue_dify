"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_localhost_ip_1 = __importDefault(require("is-localhost-ip"));
const index_js_1 = require("../index.js");
class HttpContextProvider extends index_js_1.BaseContextProvider {
    async getWorkspacePath(ide, url) {
        try {
            const currentFile = await ide.getCurrentFile();
            // `isLocalhost` actually also returns true for other local addresses, not just localhost
            return (await (0, is_localhost_ip_1.default)(url.hostname))
                ? (await ide.getWorkspaceDirs()).find((workspaceDirectory) => {
                    return currentFile?.path.startsWith(workspaceDirectory);
                })
                : undefined;
        }
        catch (e) {
            return undefined;
        }
    }
    get description() {
        return {
            title: this.options.title || HttpContextProvider.description.title,
            displayTitle: this.options.displayTitle ||
                this.options.name ||
                HttpContextProvider.description.displayTitle,
            description: this.options.description || HttpContextProvider.description.description,
            type: HttpContextProvider.description.type,
            renderInlineAs: this.options.renderInlineAs ||
                HttpContextProvider.description.renderInlineAs,
        };
    }
    async getContextItems(query, extras) {
        const parsedUrl = new URL(this.options.url);
        const response = await extras.fetch(parsedUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.options.headers || {}),
            },
            body: JSON.stringify({
                query: query || "",
                fullInput: extras.fullInput,
                options: this.options.options,
                workspacePath: await this.getWorkspacePath(extras.ide, parsedUrl),
            }),
        });
        const json = await response.json();
        try {
            const createContextItem = (item) => ({
                description: item.description ?? "HTTP Context Item",
                content: item.content ?? "",
                name: item.name ?? this.options.title ?? "HTTP",
                uri: item.uri && {
                    type: item.uri.type,
                    value: item.uri.value,
                },
            });
            return Array.isArray(json)
                ? json.map(createContextItem)
                : [createContextItem(json)];
        }
        catch (e) {
            console.warn(`Failed to parse response from custom HTTP context provider.\nError:\n${e}\nResponse from server:\n`, json);
            return [];
        }
    }
}
HttpContextProvider.description = {
    title: "http",
    displayTitle: "HTTP",
    description: "Retrieve a context item from a custom server",
    type: "normal",
    renderInlineAs: "",
};
exports.default = HttpContextProvider;
//# sourceMappingURL=HttpContextProvider.js.map