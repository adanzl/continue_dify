"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigDependentToolDefinitions = exports.getBaseToolDefinitions = void 0;
exports.serializeTool = serializeTool;
const toolSupport_1 = require("../llm/toolSupport");
const toolDefinitions = __importStar(require("./definitions"));
// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.
const getBaseToolDefinitions = () => [
    toolDefinitions.readFileTool,
    toolDefinitions.createNewFileTool,
    toolDefinitions.runTerminalCommandTool,
    toolDefinitions.globSearchTool,
    toolDefinitions.viewDiffTool,
    toolDefinitions.readCurrentlyOpenFileTool,
    toolDefinitions.lsTool,
    toolDefinitions.createRuleBlock,
    toolDefinitions.fetchUrlContentTool,
];
exports.getBaseToolDefinitions = getBaseToolDefinitions;
const getConfigDependentToolDefinitions = (params) => {
    const { modelName, isSignedIn, enableExperimentalTools, isRemote } = params;
    const tools = [];
    tools.push(toolDefinitions.requestRuleTool(params));
    if (isSignedIn) {
        // Web search is only available for signed-in users
        tools.push(toolDefinitions.searchWebTool);
    }
    if (enableExperimentalTools) {
        tools.push(toolDefinitions.viewRepoMapTool, toolDefinitions.viewSubdirectoryTool, toolDefinitions.codebaseTool, toolDefinitions.readFileRangeTool);
    }
    if (modelName && (0, toolSupport_1.isRecommendedAgentModel)(modelName)) {
        tools.push(toolDefinitions.multiEditTool);
    }
    else {
        tools.push(toolDefinitions.editFileTool);
        tools.push(toolDefinitions.singleFindAndReplaceTool);
    }
    // missing support for remote os calls: https://github.com/microsoft/vscode/issues/252269
    if (!isRemote) {
        tools.push(toolDefinitions.grepSearchTool);
    }
    return tools;
};
exports.getConfigDependentToolDefinitions = getConfigDependentToolDefinitions;
function serializeTool(tool) {
    const { preprocessArgs, evaluateToolCallPolicy, ...rest } = tool;
    return rest;
}
//# sourceMappingURL=index.js.map