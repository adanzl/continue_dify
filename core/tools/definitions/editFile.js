"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editFileTool = exports.NO_PARALLEL_TOOL_CALLING_INSTRUCTION = void 0;
const defaultSystemMessages_1 = require("../../llm/defaultSystemMessages");
const builtIn_1 = require("../builtIn");
exports.NO_PARALLEL_TOOL_CALLING_INSTRUCTION = "This tool CANNOT be called in parallel with any other tools, including itself";
const CHANGES_DESCRIPTION = "Any modifications to the file, showing only needed changes. Do NOT wrap this in a codeblock or write anything besides the code changes. In larger files, use brief language-appropriate placeholders for large unmodified sections, e.g. '// ... existing code ...'";
exports.editFileTool = {
    type: "function",
    displayTitle: "Edit File",
    wouldLikeTo: "edit {{{ filepath }}}",
    isCurrently: "editing {{{ filepath }}}",
    hasAlready: "edited {{{ filepath }}}",
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    readonly: false,
    isInstant: false,
    function: {
        name: builtIn_1.BuiltInToolNames.EditExistingFile,
        description: `Use this tool to edit an existing file. If you don't know the contents of the file, read it first.\n${defaultSystemMessages_1.EDIT_CODE_INSTRUCTIONS}\n${exports.NO_PARALLEL_TOOL_CALLING_INSTRUCTION}`,
        parameters: {
            type: "object",
            required: ["filepath", "changes"],
            properties: {
                filepath: {
                    type: "string",
                    description: "The path of the file to edit, relative to the root of the workspace.",
                },
                changes: {
                    type: "string",
                    description: CHANGES_DESCRIPTION,
                },
            },
        },
    },
    defaultToolPolicy: "allowedWithPermission",
    systemMessageDescription: {
        prefix: `To edit an EXISTING file, use the ${builtIn_1.BuiltInToolNames.EditExistingFile} tool with
- filepath: the relative filepath to the file.
- changes: ${CHANGES_DESCRIPTION}
Only use this tool if you already know the contents of the file. Otherwise, use the ${builtIn_1.BuiltInToolNames.ReadFile} or ${builtIn_1.BuiltInToolNames.ReadCurrentlyOpenFile} tool to read it first.
For example:`,
        exampleArgs: [
            ["filepath", "path/to/the_file.ts"],
            [
                "changes",
                "// ... existing code ...\nfunction subtract(a: number, b: number): number {\n  return a - b;\n}\n// ... rest of code ...",
            ],
        ],
    },
};
//# sourceMappingURL=editFile.js.map