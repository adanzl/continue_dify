"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const SentryLogger_1 = require("./sentry/SentryLogger");
class LoggerClass {
    constructor() {
        this.winston = winston_1.default.createLogger({
            level: "info",
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : "";
                return `[@continuedev] ${level}: ${message}${metaStr}`;
            })),
            transports: [
                // Write all logs with importance level of `info` or higher to `info.log`
                ...(process.env.NODE_ENV === "test"
                    ? [
                        new winston_1.default.transports.File({
                            filename: "e2e.log",
                            level: "info",
                        }),
                    ]
                    : []),
                // Normal console.log behavior
                new winston_1.default.transports.Console(),
            ],
        });
    }
    static getInstance() {
        if (!LoggerClass.instance) {
            LoggerClass.instance = new LoggerClass();
        }
        return LoggerClass.instance;
    }
    shouldSendToSentry() {
        return process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "e2e";
    }
    log(message, meta) {
        this.winston.info(message, meta);
    }
    debug(message, meta) {
        this.winston.debug(message, meta);
    }
    info(message, meta) {
        this.winston.info(message, meta);
    }
    warn(message, meta) {
        this.winston.warn(message, meta);
    }
    error(error, context) {
        let errorMessage;
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === "string") {
            errorMessage = error;
        }
        else {
            errorMessage = "An unknown error occurred";
        }
        this.winston.error(errorMessage, context);
        if (this.shouldSendToSentry() && error instanceof Error) {
            (0, SentryLogger_1.captureException)(error, context);
        }
    }
}
exports.Logger = LoggerClass.getInstance();
//# sourceMappingURL=Logger.js.map