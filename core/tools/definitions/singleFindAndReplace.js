"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleFindAndReplaceTool = void 0;
const findAndReplaceUtils_1 = require("../../edit/searchAndReplace/findAndReplaceUtils");
const performReplace_1 = require("../../edit/searchAndReplace/performReplace");
const validateArgs_1 = require("../../edit/searchAndReplace/validateArgs");
const builtIn_1 = require("../builtIn");
const editFile_1 = require("./editFile");
exports.singleFindAndReplaceTool = {
    type: "function",
    displayTitle: "Find and Replace",
    wouldLikeTo: "edit {{{ filepath }}}",
    isCurrently: "editing {{{ filepath }}}",
    hasAlready: "edited {{{ filepath }}}",
    group: builtIn_1.BUILT_IN_GROUP_NAME,
    readonly: false,
    isInstant: false,
    function: {
        name: builtIn_1.BuiltInToolNames.SingleFindAndReplace,
        description: `Performs exact string replacements in a file.

IMPORTANT:
- ALWAYS use the \`${builtIn_1.BuiltInToolNames.ReadFile}\` tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it.
- ${editFile_1.NO_PARALLEL_TOOL_CALLING_INSTRUCTION}
- When editing text from \`${builtIn_1.BuiltInToolNames.ReadFile}\` tool output, ensure you preserve exact whitespace/indentation.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable, for instance.

WARNINGS:
- When not using \`replace_all\`, the edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- The edit will likely fail if you have not recently used the \`${builtIn_1.BuiltInToolNames.ReadFile}\` tool to view up-to-date file contents.`,
        parameters: {
            type: "object",
            required: ["filepath", "old_string", "new_string"],
            properties: {
                filepath: {
                    type: "string",
                    description: "The path to the file to modify, relative to the root of the workspace",
                },
                old_string: {
                    type: "string",
                    description: "The text to replace - must be exact including whitespace/indentation",
                },
                new_string: {
                    type: "string",
                    description: "The text to replace it with (MUST be different from old_string)",
                },
                replace_all: {
                    type: "boolean",
                    description: "Replace all occurrences of old_string (default false)",
                },
            },
        },
    },
    systemMessageDescription: {
        prefix: `To perform exact string replacements in files, use the ${builtIn_1.BuiltInToolNames.SingleFindAndReplace} tool with a filepath (relative to the root of the workspace) and the strings to find and replace.

  For example, you could respond with:`,
        exampleArgs: [
            ["filepath", "path/to/file.ts"],
            ["old_string", "const oldVariable = 'value'"],
            ["new_string", "const newVariable = 'updated'"],
            ["replace_all", "false"],
        ],
    },
    defaultToolPolicy: "allowedWithPermission",
    preprocessArgs: async (args, extras) => {
        const { oldString, newString, replaceAll } = (0, findAndReplaceUtils_1.validateSingleEdit)(args.old_string, args.new_string, args.replace_all);
        const fileUri = await (0, validateArgs_1.validateSearchAndReplaceFilepath)(args.filepath, extras.ide);
        const editingFileContents = await extras.ide.readFile(fileUri);
        const newFileContents = (0, performReplace_1.executeFindAndReplace)(editingFileContents, oldString, newString, replaceAll ?? false, 0);
        return {
            ...args,
            fileUri,
            editingFileContents,
            newFileContents,
        };
    },
};
//# sourceMappingURL=singleFindAndReplace.js.map