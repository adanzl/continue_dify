"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplatedString = renderTemplatedString;
const handlebarUtils_1 = require("./handlebarUtils");
async function renderTemplatedString(handlebars, template, inputData, availableHelpers, readFile, getUriFromPath) {
    const helperPromises = availableHelpers
        ? (0, handlebarUtils_1.registerHelpers)(handlebars, availableHelpers)
        : {};
    const ctxProviderNames = availableHelpers?.map((h) => h[0]) ?? [];
    const { withLetterKeys, templateData } = await (0, handlebarUtils_1.prepareTemplatedFilepaths)(handlebars, template, inputData, ctxProviderNames, readFile, getUriFromPath);
    const templateFn = handlebars.compile(withLetterKeys);
    const renderedString = templateFn(templateData);
    return (0, handlebarUtils_1.resolveHelperPromises)(renderedString, helperPromises);
}
//# sourceMappingURL=renderTemplatedString.js.map