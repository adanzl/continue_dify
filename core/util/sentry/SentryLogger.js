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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentryLogger = void 0;
exports.initializeSentry = initializeSentry;
exports.createSpan = createSpan;
exports.captureException = captureException;
exports.captureLog = captureLog;
const Sentry = __importStar(require("@sentry/node"));
const node_os_1 = __importDefault(require("node:os"));
const isContinueTeamMember_js_1 = require("../isContinueTeamMember.js");
const anonymization_js_1 = require("./anonymization.js");
const constants_js_1 = require("./constants.js");
class SentryLogger {
    static initializeSentryClient(release) {
        try {
            // For shared environments like VSCode extensions, we need to avoid global state pollution
            // Filter out integrations that use global state
            // See https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/
            // Filter integrations that use the global variable
            const integrations = Sentry.getDefaultIntegrations({}).filter((defaultIntegration) => {
                // Remove integrations that might interfere with shared environments
                return ![
                    "OnUncaughtException",
                    "OnUnhandledRejection",
                    "ContextLines",
                    "LocalVariables",
                ].includes(defaultIntegration.name);
            });
            // Create client manually without polluting global state
            const client = new Sentry.NodeClient({
                dsn: constants_js_1.SENTRY_DSN,
                release,
                environment: process.env.NODE_ENV,
                transport: Sentry.makeNodeTransport,
                stackParser: Sentry.defaultStackParser,
                // For basic error tracking, a lower sample rate should be fine
                sampleRate: 0.1,
                tracesSampleRate: 0.1,
                // Privacy-conscious default
                sendDefaultPii: false,
                // Strip sensitive data and add basic properties before sending events
                beforeSend(event) {
                    // First apply anonymization
                    const anonymizedEvent = (0, anonymization_js_1.anonymizeSentryEvent)(event);
                    if (!anonymizedEvent)
                        return null;
                    // Add basic properties similar to PostHog telemetry
                    if (!anonymizedEvent.tags)
                        anonymizedEvent.tags = {};
                    if (!anonymizedEvent.extra)
                        anonymizedEvent.extra = {};
                    // Add OS information
                    if (SentryLogger.os) {
                        anonymizedEvent.tags.os = SentryLogger.os;
                    }
                    // Add ideInfo properties spread out as top-level properties
                    if (SentryLogger.ideInfo) {
                        anonymizedEvent.tags.extensionVersion =
                            SentryLogger.ideInfo.extensionVersion;
                        anonymizedEvent.tags.ideName = SentryLogger.ideInfo.name;
                        anonymizedEvent.tags.ideType = SentryLogger.ideInfo.ideType;
                        anonymizedEvent.tags.ideVersion = SentryLogger.ideInfo.version;
                        anonymizedEvent.tags.remoteName = SentryLogger.ideInfo.remoteName;
                        anonymizedEvent.tags.isPrerelease =
                            SentryLogger.ideInfo.isPrerelease;
                    }
                    return anonymizedEvent;
                },
                // Use filtered integrations for Node.js/VSCode shared environment
                integrations,
                // Enable structured logging
                _experiments: {
                    enableLogs: true,
                },
            });
            // Create a new scope and set the client
            const scope = new Sentry.Scope();
            scope.setClient(client);
            // Initialize the client after setting it on the scope
            client.init();
            return { client, scope };
        }
        catch (error) {
            console.error("Failed to initialize Sentry client:", error);
            return { client: undefined, scope: undefined };
        }
    }
    static async setup(allowAnonymousTelemetry, uniqueId, ideInfo, userEmail) {
        // TODO: Remove Continue team member check once Sentry is ready for all users
        SentryLogger.allowTelemetry =
            allowAnonymousTelemetry && (0, isContinueTeamMember_js_1.isContinueTeamMember)(userEmail);
        SentryLogger.uniqueId = uniqueId;
        SentryLogger.ideInfo = ideInfo;
        SentryLogger.os = node_os_1.default.platform();
        if (!SentryLogger.allowTelemetry) {
            SentryLogger.client = undefined;
            SentryLogger.scope = undefined;
        }
        else if (!SentryLogger.client) {
            const { client, scope } = SentryLogger.initializeSentryClient(ideInfo.extensionVersion);
            SentryLogger.client = client;
            SentryLogger.scope = scope;
        }
    }
    static ensureInitialized() {
        if (!SentryLogger.allowTelemetry || SentryLogger.client) {
            return;
        }
        if (SentryLogger.ideInfo) {
            const { client, scope } = SentryLogger.initializeSentryClient(SentryLogger.ideInfo.extensionVersion);
            SentryLogger.client = client;
            SentryLogger.scope = scope;
        }
    }
    static get lazyClient() {
        SentryLogger.ensureInitialized();
        return SentryLogger.client;
    }
    static get lazyScope() {
        SentryLogger.ensureInitialized();
        return SentryLogger.scope;
    }
    static shutdownSentryClient() {
        if (SentryLogger.client) {
            void SentryLogger.client.close();
            SentryLogger.client = undefined;
            SentryLogger.scope = undefined;
        }
    }
}
exports.SentryLogger = SentryLogger;
SentryLogger.client = undefined;
SentryLogger.scope = undefined;
SentryLogger.uniqueId = "NOT_UNIQUE";
SentryLogger.os = undefined;
SentryLogger.ideInfo = undefined;
SentryLogger.allowTelemetry = false;
/**
 * Initialize Sentry for error tracking, performance monitoring, and structured logging.
 * Returns the Sentry client and scope, or undefined objects if telemetry is disabled.
 */
function initializeSentry() {
    return {
        client: SentryLogger.lazyClient,
        scope: SentryLogger.lazyScope,
    };
}
// Export utility functions for using Sentry throughout the application
/**
 * Create a custom span for performance monitoring
 *
 * @param operation The operation category (e.g., "http.client", "ui.click", "db.query")
 * @param name A descriptive name for the span
 * @param callback The function to execute within the span
 * @returns The result of the callback function
 */
function createSpan(operation, name, callback) {
    const client = SentryLogger.lazyClient;
    if (!client) {
        return callback();
    }
    // Use withScope from Sentry to isolate the span context
    return Sentry.withScope((isolatedScope) => {
        isolatedScope.setClient(client);
        return Sentry.startSpan({
            op: operation,
            name,
        }, () => callback());
    });
}
/**
 * Capture an exception and send it to Sentry
 *
 * @param error The error to capture
 * @param context Additional context information
 */
function captureException(error, context) {
    const scope = SentryLogger.lazyScope;
    if (!scope) {
        return;
    }
    try {
        // Add context to scope if provided
        if (context) {
            scope.setExtras(context);
        }
        // Use scope's captureException to avoid global state
        scope.captureException(error);
    }
    catch (e) {
        console.error(`Failed to capture exception to Sentry: ${e}`);
    }
}
/**
 * Capture a structured log message and send it to Sentry
 *
 * @param message The log message
 * @param level The severity level (default: 'info')
 * @param context Additional context information
 */
function captureLog(message, level = "info", context) {
    const scope = SentryLogger.lazyScope;
    if (!scope) {
        return;
    }
    try {
        // Add context to scope if provided
        if (context) {
            scope.setExtras(context);
        }
        // Use scope's captureMessage to avoid global state
        scope.captureMessage(message, level);
    }
    catch (e) {
        console.error(`Failed to capture log to Sentry: ${e}`);
    }
}
//# sourceMappingURL=SentryLogger.js.map