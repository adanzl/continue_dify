"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHelpers = registerHelpers;
exports.prepareTemplatedFilepaths = prepareTemplatedFilepaths;
exports.resolveHelperPromises = resolveHelperPromises;
const uuid_1 = require("uuid");
function convertToLetter(num) {
    let result = "";
    while (num > 0) {
        const remainder = (num - 1) % 26;
        result = String.fromCharCode(97 + remainder) + result;
        num = Math.floor((num - 1) / 26);
    }
    return result;
}
function registerHelpers(handlebars, helpers) {
    const promises = {};
    for (const [name, helper] of helpers) {
        handlebars.registerHelper(name, (...args) => {
            const id = (0, uuid_1.v4)();
            promises[id] = helper(...args);
            return `__${id}__`;
        });
    }
    return promises;
}
async function prepareTemplatedFilepaths(handlebars, template, inputData, ctxProviderNames, readFile, getUriFromPath) {
    // First, replace filepaths with letters to avoid escaping issues
    const ast = handlebars.parse(template);
    const filepathLetters = new Map();
    const requiredContextProviders = new Set();
    let withLetterKeys = template;
    let letterIndex = 1;
    for (const i in ast.body) {
        const node = ast.body[i];
        if (node.type === "MustacheStatement") {
            const originalNodeVal = node.path.original;
            if (originalNodeVal.toLowerCase() === "input") {
                continue;
            }
            const isFilepath = !ctxProviderNames.includes(originalNodeVal);
            if (isFilepath) {
                const letter = convertToLetter(letterIndex);
                filepathLetters.set(letter, originalNodeVal);
                withLetterKeys = withLetterKeys.replace(new RegExp(`{{\\s*${originalNodeVal}\\s*}}`), `{{${letter}}}`);
                letterIndex++;
            }
            else {
                requiredContextProviders.add(originalNodeVal);
            }
        }
    }
    // Then, resolve the filepaths to their actual content and add to template data
    // Fallback to simple error string if file read fails
    const templateData = { ...inputData };
    for (const [letter, filepath] of filepathLetters.entries()) {
        try {
            const uri = await getUriFromPath(filepath);
            if (uri) {
                const fileContents = await readFile(uri);
                templateData[letter] = fileContents;
            }
            else {
                throw new Error(`File not found: ${filepath}`);
            }
        }
        catch (e) {
            console.error(`Error reading file in prompt file ${filepath}:`, e);
            templateData[letter] = `[Error reading file "${filepath}"]`;
        }
    }
    return { withLetterKeys, templateData, requiredContextProviders };
}
async function resolveHelperPromises(renderedString, promises) {
    await Promise.all(Object.values(promises));
    for (const id in promises) {
        renderedString = renderedString.replace(`__${id}__`, await promises[id]);
    }
    return renderedString;
}
//# sourceMappingURL=handlebarUtils.js.map