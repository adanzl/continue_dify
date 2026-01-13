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
exports.HistoryManager = void 0;
const fs = __importStar(require("fs"));
const constants_js_1 = require("./constants.js");
const paths_js_1 = require("./paths.js");
function safeParseArray(value, errorMessage = "Error parsing array") {
    try {
        return JSON.parse(value);
    }
    catch (e) {
        console.warn(`${errorMessage}: ${e}`);
        return undefined;
    }
}
class HistoryManager {
    list(options) {
        const filepath = (0, paths_js_1.getSessionsListPath)();
        if (!fs.existsSync(filepath)) {
            return [];
        }
        const content = fs.readFileSync(filepath, "utf8");
        let sessions = safeParseArray(content) ?? [];
        sessions = sessions
            .filter((session) => {
            // Filter out old format
            return typeof session.session_id !== "string";
            // Reverse to show newest first; sessions.json is chronological by creation
        })
            .reverse();
        // Apply limit and offset
        if (options.limit) {
            const offset = options.offset || 0;
            sessions = sessions.slice(offset, offset + options.limit);
        }
        return sessions;
    }
    delete(sessionId) {
        // Delete a session
        const sessionFile = (0, paths_js_1.getSessionFilePath)(sessionId);
        if (!fs.existsSync(sessionFile)) {
            throw new Error(`Session file ${sessionFile} does not exist`);
        }
        fs.unlinkSync(sessionFile);
        // Read and update the sessions list
        const sessionsListFile = (0, paths_js_1.getSessionsListPath)();
        const sessionsListRaw = fs.readFileSync(sessionsListFile, "utf-8");
        let sessionsList = safeParseArray(sessionsListRaw, "Error parsing sessions.json") ?? [];
        sessionsList = sessionsList.filter((session) => session.sessionId !== sessionId);
        fs.writeFileSync(sessionsListFile, JSON.stringify(sessionsList, undefined, 2));
    }
    clearAll() {
        fs.rmSync((0, paths_js_1.getSessionsFolderPath)(), { recursive: true, force: true });
    }
    load(sessionId) {
        try {
            const sessionFile = (0, paths_js_1.getSessionFilePath)(sessionId);
            if (!fs.existsSync(sessionFile)) {
                throw new Error(`Session file ${sessionFile} does not exist`);
            }
            const session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
            session.sessionId = sessionId;
            return session;
        }
        catch (e) {
            console.log(`Error loading session: ${e}`);
            return {
                history: [],
                title: constants_js_1.NEW_SESSION_TITLE,
                workspaceDirectory: "",
                sessionId: sessionId,
            };
        }
    }
    save(session) {
        // Save the main session json file
        // Explicitely rewriting here to influence the written key order in the file!
        // e.g. id at the top, history next, etc.
        const orderedSession = {
            sessionId: session.sessionId,
            title: session.title,
            workspaceDirectory: session.workspaceDirectory,
            history: session.history,
        };
        if (session.mode) {
            orderedSession.mode = session.mode;
        }
        if (session.chatModelTitle !== undefined) {
            orderedSession.chatModelTitle = session.chatModelTitle;
        }
        if (session.usage !== undefined) {
            orderedSession.usage = session.usage;
        }
        fs.writeFileSync((0, paths_js_1.getSessionFilePath)(session.sessionId), JSON.stringify(orderedSession, undefined, 2));
        // Read and update the sessions list
        const sessionsListFilePath = (0, paths_js_1.getSessionsListPath)();
        try {
            const rawSessionsList = fs.readFileSync(sessionsListFilePath, "utf-8");
            let sessionsList;
            try {
                sessionsList = JSON.parse(rawSessionsList);
            }
            catch (e) {
                if (rawSessionsList.trim() === "") {
                    fs.writeFileSync(sessionsListFilePath, JSON.stringify([]));
                    sessionsList = [];
                }
                else {
                    throw e;
                }
            }
            let found = false;
            for (const sessionMetadata of sessionsList) {
                if (sessionMetadata.sessionId === session.sessionId) {
                    sessionMetadata.title = session.title;
                    sessionMetadata.workspaceDirectory = session.workspaceDirectory;
                    found = true;
                    break;
                }
            }
            if (!found) {
                const sessionMetadata = {
                    sessionId: session.sessionId,
                    title: session.title,
                    dateCreated: String(Date.now()),
                    workspaceDirectory: session.workspaceDirectory,
                };
                sessionsList.push(sessionMetadata);
            }
            fs.writeFileSync(sessionsListFilePath, JSON.stringify(sessionsList, undefined, 2));
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`It looks like there is a JSON formatting error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session.`);
            }
            throw new Error(`It looks like there is a validation error in your sessions.json file (${sessionsListFilePath}). Please fix this before creating a new session. Error: ${error}`);
        }
    }
}
exports.HistoryManager = HistoryManager;
const historyManager = new HistoryManager();
exports.default = historyManager;
//# sourceMappingURL=history.js.map