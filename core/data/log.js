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
exports.DataLogger = exports.LOCAL_DEV_DATA_VERSION = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_yaml_1 = require("@continuedev/config-yaml");
const fetch_1 = require("@continuedev/fetch");
const URI = __importStar(require("uri-js"));
const url_1 = require("url");
const paths_js_1 = require("../util/paths.js");
const uri_js_1 = require("../util/uri.js");
const DEFAULT_DEV_DATA_LEVEL = "all";
exports.LOCAL_DEV_DATA_VERSION = "0.2.0";
class DataLogger {
    constructor() { }
    static getInstance() {
        if (DataLogger.instance === null) {
            DataLogger.instance = new DataLogger();
        }
        return DataLogger.instance;
    }
    async addBaseValues(body, eventName, schema, zodSchema) {
        const newBody = { ...body };
        const ideSettings = await this.ideSettingsPromise;
        const ideInfo = await this.ideInfoPromise;
        if ("eventName" in zodSchema.shape) {
            newBody.eventName = eventName;
        }
        if (!newBody.timestamp && "timestamp" in zodSchema.shape) {
            newBody.timestamp = new Date().toISOString();
        }
        if ("schema" in zodSchema.shape) {
            newBody.schema = schema;
        }
        if ("userAgent" in zodSchema.shape) {
            newBody.userAgent = ideInfo
                ? `${ideInfo.name}/${ideInfo.version} (Continue/${ideInfo.extensionVersion})`
                : "Unknown/Unknown (Continue/Unknown)";
        }
        if ("selectedProfileId" in zodSchema.shape) {
            newBody.selectedProfileId =
                this.core?.configHandler.currentProfile?.profileDescription.id ?? "";
        }
        if ("userId" in zodSchema.shape) {
            newBody.userId = ideSettings?.userToken ?? "";
        }
        return newBody;
    }
    async logLocalData(event) {
        try {
            const filepath = (0, paths_js_1.getDevDataFilePath)(event.name, exports.LOCAL_DEV_DATA_VERSION);
            const localSchema = config_yaml_1.devDataVersionedSchemas[exports.LOCAL_DEV_DATA_VERSION]["all"][event.name];
            if (!localSchema) {
                throw new Error(`Schema ${exports.LOCAL_DEV_DATA_VERSION} doesn't exist at level "all"`);
            }
            const eventDataWithBaseValues = await this.addBaseValues(event.data, event.name, exports.LOCAL_DEV_DATA_VERSION, localSchema);
            const parsed = localSchema?.safeParse(eventDataWithBaseValues);
            if (parsed?.success) {
                fs_1.default.writeFileSync(filepath, `${JSON.stringify(parsed.data)}\n`, {
                    flag: "a",
                });
            }
        }
        catch (error) {
            console.error("Error logging local dev data:", error);
        }
    }
    async logDevData(event) {
        // Local logs (always on for all levels)
        await this.logLocalData(event);
        // Remote logs
        const config = (await this.core?.configHandler.loadConfig())?.config;
        if (config?.data?.length) {
            await Promise.allSettled(config.data.map((dataConfig) => this.logToOneDestination(dataConfig, event)));
        }
    }
    async parseEventData(event, schema, level) {
        const versionSchemas = config_yaml_1.devDataVersionedSchemas[schema];
        if (!versionSchemas) {
            throw new Error(`Attempting to log dev data to non-existent version ${schema}`);
        }
        const levelSchemas = versionSchemas[level];
        if (!levelSchemas) {
            throw new Error(`Attempting to log dev data at level ${level} for version ${schema} which does not exist`);
        }
        const zodSchema = levelSchemas[event.name];
        if (!zodSchema) {
            throw new Error(`Attempting to log dev data for event ${event.name} at level ${level} for version ${schema}: no schema found`);
        }
        const eventDataWithBaseValues = await this.addBaseValues(event.data, event.name, schema, zodSchema);
        const parsed = zodSchema.safeParse(eventDataWithBaseValues);
        if (!parsed.success) {
            throw new Error(`Failed to parse event data for event ${event.name} and schema ${schema}\n:${parsed.error.toString()}`);
        }
        return parsed.data;
    }
    async logToOneDestination(dataConfig, event) {
        try {
            if (!dataConfig) {
                return;
            }
            // First extract the data schema based on the version and level
            const { schema } = dataConfig;
            const level = dataConfig.level ?? DEFAULT_DEV_DATA_LEVEL;
            // Skip event if `events` is specified and does not include the event
            const events = dataConfig.events ?? config_yaml_1.allDevEventNames;
            if (!events.includes(event.name)) {
                return;
            }
            // Parse the event data, throwing if it fails
            const parsed = await this.parseEventData(event, schema, level);
            const uriComponents = URI.parse(dataConfig.destination);
            // Send to remote server
            if (uriComponents.scheme === "https" || uriComponents.scheme === "http") {
                const headers = {
                    "Content-Type": "application/json",
                };
                // If an API key is provided, use it, otherwise use the Continue access token
                if (dataConfig.apiKey) {
                    headers["Authorization"] = `Bearer ${dataConfig.apiKey}`;
                }
                else {
                    const accessToken = await this.core?.configHandler.controlPlaneClient.getAccessToken();
                    headers["Authorization"] = `Bearer ${accessToken}`;
                }
                const profileId = this.core?.configHandler.currentProfile?.profileDescription.id ?? "";
                const response = await (0, fetch_1.fetchwithRequestOptions)(dataConfig.destination, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        name: event.name,
                        data: parsed,
                        schema,
                        level,
                        profileId,
                    }),
                }, dataConfig.requestOptions);
                if (!response.ok) {
                    throw new Error(`Post request failed. ${response.status}: ${response.statusText}`);
                }
            }
            else if (uriComponents.scheme === "file") {
                // Write to jsonc file for local file URIs
                const dirUri = (0, uri_js_1.joinPathsToUri)(dataConfig.destination, schema);
                const dirPath = (0, url_1.fileURLToPath)(dirUri);
                if (!fs_1.default.existsSync(dirPath)) {
                    fs_1.default.mkdirSync(dirPath, { recursive: true });
                }
                const filepath = path_1.default.join(dirPath, `${event.name}.jsonl`);
                const jsonLine = JSON.stringify(event.data);
                fs_1.default.writeFileSync(filepath, `${jsonLine}\n`, { flag: "a" });
            }
            else {
                throw new Error(`Unsupported URI scheme ${uriComponents.scheme}`);
            }
        }
        catch (error) {
            console.error(`Error logging data to ${dataConfig.destination}: ${error instanceof Error ? error.message : error}`);
        }
    }
}
exports.DataLogger = DataLogger;
DataLogger.instance = null;
//# sourceMappingURL=log.js.map