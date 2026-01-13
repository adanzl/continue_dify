"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findFaviconPath = findFaviconPath;
exports.getFaviconBase64 = getFaviconBase64;
exports.fetchFavicon = fetchFavicon;
const jsdom_1 = require("jsdom");
async function findFaviconPath(url) {
    const baseUrl = `${url.protocol}//${url.hostname}`;
    try {
        const response = await fetch(baseUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const dom = new jsdom_1.JSDOM(html);
        const document = dom.window.document;
        // Look for favicon in <link> tags
        const linkTags = document.querySelectorAll('link[rel*="icon"]');
        for (const link of linkTags) {
            const href = link.getAttribute("href");
            if (href) {
                return new URL(href, baseUrl).toString();
            }
        }
    }
    catch (error) {
        console.debug(`Failed to fetch favicon for ${baseUrl}: ${error}`);
    }
    console.debug(`Failed to find favicon for ${baseUrl}`);
    return undefined;
}
async function getFaviconBase64(faviconUrl) {
    try {
        const response = await fetch(faviconUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
        const mimeType = response.headers.get("content-type") || "image/x-icon";
        return `data:${mimeType};base64,${base64}`;
    }
    catch (error) {
        console.debug(`Failed to fetch favicon from ${faviconUrl}: ${error}`);
        return undefined;
    }
}
async function fetchFavicon(url) {
    const faviconPath = await findFaviconPath(url);
    if (faviconPath) {
        return getFaviconBase64(faviconPath);
    }
    return undefined;
}
//# sourceMappingURL=fetchFavicon.js.map