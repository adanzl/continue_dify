"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRelativePathInDir = resolveRelativePathInDir;
exports.inferResolvedUriFromRelativePath = inferResolvedUriFromRelativePath;
const uri_1 = require("./uri");
/*
  This function takes a relative (to workspace) filepath
  And checks each workspace for if it exists or not
  Only returns fully resolved URI if it exists
*/
async function resolveRelativePathInDir(path, ide, dirUriCandidates) {
    const dirs = dirUriCandidates ?? (await ide.getWorkspaceDirs());
    for (const dirUri of dirs) {
        const fullUri = (0, uri_1.joinPathsToUri)(dirUri, path);
        if (await ide.fileExists(fullUri)) {
            return fullUri;
        }
    }
    return undefined;
}
/*
  Same as above but in this case the relative path does not need to exist (e.g. file to be created, etc)
  Checks closes match with the dirs, path segment by segment
  and based on which workspace has the closest matching path, returns resolved URI
  If no meaninful path match just concatenates to first dir's uri
*/
async function inferResolvedUriFromRelativePath(_relativePath, ide, dirCandidates) {
    const relativePath = _relativePath.trim().replaceAll("\\", "/");
    const dirs = dirCandidates ?? (await ide.getWorkspaceDirs());
    if (dirs.length === 0) {
        throw new Error("inferResolvedUriFromRelativePath: no dirs provided");
    }
    const segments = (0, uri_1.pathToUriPathSegment)(relativePath).split("/");
    // Generate all possible suffixes from shortest to longest
    const suffixes = [];
    for (let i = segments.length - 1; i >= 0; i--) {
        suffixes.push(segments.slice(i).join("/"));
    }
    // For each suffix, try to find a unique matching dir/file
    for (const suffix of suffixes) {
        const uris = dirs.map((dir) => ({
            dir,
            partialUri: (0, uri_1.joinEncodedUriPathSegmentToUri)(dir, suffix),
        }));
        const promises = uris.map(async ({ partialUri, dir }) => {
            const exists = await ide.fileExists(partialUri);
            return {
                dir,
                partialUri,
                exists,
            };
        });
        const existenceChecks = await Promise.all(promises);
        const existingUris = existenceChecks.filter(({ exists }) => exists);
        // If exactly one directory matches, use it
        if (existingUris.length === 1) {
            return (0, uri_1.joinEncodedUriPathSegmentToUri)(existingUris[0].dir, segments.join("/"));
        }
    }
    // Sometimes the model will decide to only output the base name or small number of path parts
    // in which case we shouldn't create a new file if it matches the current file
    const activeFile = await ide.getCurrentFile();
    if (activeFile && activeFile.path.endsWith(relativePath)) {
        return activeFile.path;
    }
    // If no unique match found, use the first directory
    return (0, uri_1.joinPathsToUri)(dirs[0], relativePath);
}
//# sourceMappingURL=ideUtils.js.map