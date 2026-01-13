"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiEditTool = void 0;
const multiEditValidation_1 = require("../../edit/searchAndReplace/multiEditValidation");
const performReplace_1 = require("../../edit/searchAndReplace/performReplace");
const validateArgs_1 = require("../../edit/searchAndReplace/validateArgs");
const builtIn_1 = require("../builtIn");
const editFile_1 = require("./editFile");
exports.multiEditTool = {
    type: "function",
    displayTitle: "Multi Edit",
    wouldLikeTo: "edit {{{ filepath }}}",
    isCurrently: "editing {{{ filepath }}}",
    hasAlready: "edited {{{ filepath }}}",
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    readonly: false,
    isInstant: false,
    function: {
        name: builtIn_1.BuiltInToolNames.MultiEdit,
        description: `Use this tool to make multiple edits to a single file in one operation. It allows you to perform multiple find-and-replace operations efficiently. 

To make multiple edits to a file, provide the following:
1. filepath: The path to the file to modify, RELATIVE to the project/workspace root (verify the directory path is correct)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the old file contents exactly, including all whitespace/indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurrences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- Files may be modified between tool calls by users, linters, etc, so always make all edits in one tool call where possible. For example, do not only edit imports if there are other changes in the file, as unused imports may be removed by a linter between tool calls.
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit, so plan your edits carefully to avoid conflicts between sequential operations
- Edits are atomic - all edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:
1. ALWAYS use the ${builtIn_1.BuiltInToolNames.ReadFile} tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it.
2. ${editFile_1.NO_PARALLEL_TOOL_CALLING_INSTRUCTION}
3. When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked
- Use replace_all for replacing and renaming all matches for a string across the file. This parameter is useful if you want to rename a variable, for instance

WARNINGS:
- If earlier edits affect the text that later edits are trying to find, files can become mangled
- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.old_string and edits.new_string are the same - they MUST be different`,
        parameters: {
            type: "object",
            required: ["filepath", "edits"],
            properties: {
                filepath: {
                    type: "string",
                    description: "The path to the file to modify, relative to the root of the workspace",
                },
                edits: {
                    type: "array",
                    description: "Array of edit operations to perform sequentially on the file",
                    items: {
                        type: "object",
                        required: ["old_string", "new_string"],
                        properties: {
                            old_string: {
                                type: "string",
                                description: "The text to replace (exact match including whitespace/indentation)",
                            },
                            new_string: {
                                type: "string",
                                description: "The text to replace it with. MUST be different than old_string.",
                            },
                            replace_all: {
                                type: "boolean",
                                description: "Replace all occurrences of old_string (default false) in the file",
                            },
                        },
                    },
                },
            },
        },
    },
    systemMessageDescription: {
        prefix: `To make multiple edits to a single file, use the ${builtIn_1.BuiltInToolNames.MultiEdit} tool with a filepath (relative to the root of the workspace) and an array of edit operations.

  For example, you could respond with:`,
        exampleArgs: [
            ["filepath", "path/to/file.ts"],
            [
                "edits",
                `[
  { "old_string": "const oldVar = 'value'", "new_string": "const newVar = 'updated'" },
  { "old_string": "oldFunction()", "new_string": "newFunction()", "replace_all": true }
]`,
            ],
        ],
    },
    defaultToolPolicy: "allowedWithPermission",
    preprocessArgs: async (args, extras) => {
        const { edits } = (0, multiEditValidation_1.validateMultiEdit)(args);
        const fileUri = await (0, validateArgs_1.validateSearchAndReplaceFilepath)(args.filepath, extras.ide);
        const editingFileContents = await extras.ide.readFile(fileUri);
        const newFileContents = (0, performReplace_1.executeMultiFindAndReplace)(editingFileContents, edits);
        return {
            ...args,
            fileUri,
            editingFileContents,
            newFileContents,
        };
    },
};
//# sourceMappingURL=multiEdit.js.map