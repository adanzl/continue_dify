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
exports.LocalPlatformClient = void 0;
const config_yaml_1 = require("@continuedev/config-yaml");
const dotenv = __importStar(require("dotenv"));
const paths_1 = require("../../util/paths");
const uri_1 = require("../../util/uri");
class LocalPlatformClient {
    constructor(orgScopeId, client, ide) {
        this.orgScopeId = orgScopeId;
        this.client = client;
        this.ide = ide;
    }
    /**
     * searches for the first valid secret file in order of ~/.continue/.env, <workspace>/.continue/.env, <workspace>/.env
     */
    async findSecretInEnvFiles(fqsn) {
        const secretValue = this.findSecretInLocalEnvFile(fqsn) ??
            (await this.findSecretInWorkspaceEnvFiles(fqsn, true)) ??
            (await this.findSecretInWorkspaceEnvFiles(fqsn, false));
        if (secretValue) {
            return {
                found: true,
                fqsn,
                value: secretValue,
                secretLocation: {
                    secretName: fqsn.secretName,
                    secretType: config_yaml_1.SecretType.LocalEnv,
                },
            };
        }
        return undefined;
    }
    findSecretInLocalEnvFile(fqsn) {
        try {
            const dotEnv = (0, paths_1.getContinueDotEnv)();
            return dotEnv[fqsn.secretName];
        }
        catch (error) {
            console.warn(`Error reading ~/.continue/.env file: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    async findSecretInWorkspaceEnvFiles(fqsn, insideContinue) {
        try {
            const workspaceDirs = await this.ide.getWorkspaceDirs();
            for (const folder of workspaceDirs) {
                const envFilePath = (0, uri_1.joinPathsToUri)(folder, insideContinue ? ".continue" : "", ".env");
                try {
                    const fileExists = await this.ide.fileExists(envFilePath);
                    if (fileExists) {
                        const envContent = await this.ide.readFile(envFilePath);
                        const env = dotenv.parse(envContent);
                        if (fqsn.secretName in env) {
                            return env[fqsn.secretName];
                        }
                    }
                }
                catch (error) {
                    console.warn(`Error reading workspace .env file at ${envFilePath}: ${error instanceof Error ? error.message : String(error)}`);
                    // Continue to next workspace folder
                }
            }
            return undefined;
        }
        catch (error) {
            console.warn(`Error searching workspace .env files: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    async resolveFQSNs(fqsns) {
        if (fqsns.length === 0) {
            return [];
        }
        let results = [];
        try {
            results = await this.client.resolveFQSNs(fqsns, this.orgScopeId);
        }
        catch (e) {
            console.error("Error getting secrets from control plane", e);
        }
        // For any secret that isn't found, look in .env files, then process.env
        for (let i = 0; i < results.length; i++) {
            if (!results[i]?.found) {
                let secretResult = await this.findSecretInEnvFiles(fqsns[i]);
                // If not found in .env files, try process.env
                if (!secretResult?.found) {
                    const secretValueFromProcessEnv = process.env[fqsns[i].secretName];
                    if (secretValueFromProcessEnv !== undefined) {
                        secretResult = {
                            found: true,
                            fqsn: fqsns[i],
                            value: secretValueFromProcessEnv,
                            secretLocation: {
                                secretName: fqsns[i].secretName,
                                // Cast to SecretType.ProcessEnv is necessary because the specific type
                                // ProcessEnvSecretLocation expects secretType to be exactly SecretType.ProcessEnv,
                                // not the general enum SecretType.
                                secretType: config_yaml_1.SecretType.ProcessEnv,
                            },
                        };
                    }
                }
                if (secretResult?.found) {
                    results[i] = secretResult;
                }
            }
        }
        return results;
    }
}
exports.LocalPlatformClient = LocalPlatformClient;
//# sourceMappingURL=LocalPlatformClient.js.map