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
exports.validateLicenseKey = validateLicenseKey;
exports.getLicenseKeyData = getLicenseKeyData;
exports.setMdmLicenseKey = setMdmLicenseKey;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const plist = __importStar(require("plist"));
const CONTINUE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz1pFVzsW2UScSnaPAwFp
93QU4+txtyJj8AOC3Kx7YkX1d48DGU2Fy1he7SXPHgcuhXYIqfWGn/Vy/4yJxXD7
HlU8RM7LlWHRk7ecAvF4WtxZDjPE0OSG5T69w5f7tMCtQPQseInCKqleJuCjxrvA
zyTWTwKA1S6e+KxXS/kbqsumriljFujNr6Gmh8ygDnpF055Xo0vTenkMipVw/oYn
U0EHx5ic+Fmcob3EyOj25lu/CVYtU1Rn8jPbrBOMiIq5sePh2QXOwGRsuTiZk2mP
LXSsjLbeWHifRrQ18wj/PC990E33QaFGNFp0NcBXMPbq5eKYKEzKZ0GsxtLoGxar
FQIDAQAB
-----END PUBLIC KEY-----`;
function validateLicenseKey(licenseKey) {
    try {
        // Decode the base64 license key
        const decodedString = Buffer.from(licenseKey, "base64").toString("utf8");
        const { data, signature, unsignedData } = JSON.parse(decodedString);
        // Verify the signature
        const verify = crypto.createVerify("SHA256");
        verify.update(data);
        verify.end();
        const isValid = verify.verify(CONTINUE_PUBLIC_KEY, signature, "base64");
        if (!isValid)
            return { isValid: false };
        // Check license expiration
        const licenseData = JSON.parse(data);
        const expirationDate = new Date(licenseData.expiresAt);
        const now = new Date();
        const isNotExpired = expirationDate > now;
        if (!isNotExpired)
            return { isValid: false };
        // Return both validation result and license key data
        const licenseKeyData = {
            signature,
            data,
            unsignedData,
        };
        return { isValid: true, licenseKeyData };
    }
    catch (error) {
        console.error("License validation error:", error);
        return { isValid: false };
    }
}
const MACOS_MDM_PATHS = [
    // Organization-specific MDM plist
    "/Library/Managed Preferences/dev.continue.app.plist",
    // User-specific MDM plist
    path.join(os.homedir(), "Library/Managed Preferences/dev.continue.app.plist"),
];
function readMdmKeysMacOS() {
    try {
        // MDM configuration is typically stored in /Library/Managed Preferences/ on macOS
        // The filename is often the bundle identifier of the application
        // Try to find a valid MDM configuration file
        for (const mdmPath of MACOS_MDM_PATHS) {
            if (fs.existsSync(mdmPath)) {
                // Read the file content
                const fileContent = fs.readFileSync(mdmPath, "utf8");
                try {
                    // Parse the plist file using the plist package
                    const config = plist.parse(fileContent);
                    if (config && config?.licenseKey) {
                        // Extract the license key from the configuration
                        return { licenseKey: config?.licenseKey };
                    }
                    else {
                        console.error("Invalid MDM configuration format");
                    }
                }
                catch (parseError) {
                    console.error(`Error parsing MDM configuration: ${parseError}`);
                }
            }
        }
        return undefined;
    }
    catch (error) {
        console.error("Error reading macOS MDM keys:", error);
        return undefined;
    }
}
function readMdmKeysWindows() {
    try {
        // For Windows, we need to read from the registry
        // Using regedit or another synchronous registry access module
        const { execSync } = require("child_process");
        // Path to the registry where MDM configuration is stored
        const regPath = "HKLM\\Software\\Continue\\MDM";
        const userRegPath = "HKCU\\Software\\Continue\\MDM";
        // Try to read from HKEY_LOCAL_MACHINE first
        try {
            // Use REG QUERY command to read registry values
            const licenseKeyCmd = `reg query "${regPath}" /v licenseKey`;
            const licenseKeyOutput = execSync(licenseKeyCmd, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            // Extract values from command output
            const licenseKey = extractRegValue(licenseKeyOutput);
            if (licenseKey) {
                return { licenseKey };
            }
        }
        catch (error) {
            // Registry key might not exist, fallback to HKEY_CURRENT_USER
        }
        // Try HKEY_CURRENT_USER if not found in HKEY_LOCAL_MACHINE
        try {
            const licenseKeyCmd = `reg query "${userRegPath}" /v licenseKey`;
            const licenseKeyOutput = execSync(licenseKeyCmd, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            // Extract values from command output
            const licenseKey = extractRegValue(licenseKeyOutput);
            if (licenseKey) {
                return { licenseKey };
            }
        }
        catch (error) {
            // Registry key might not exist in HKCU either
        }
        return undefined;
    }
    catch (error) {
        console.error("Error reading Windows MDM keys:", error);
        return undefined;
    }
}
// Helper function to extract registry values from reg query output
function extractRegValue(output) {
    const match = output.match(/REG_SZ\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
}
// Common locations for MDM configurations in Linux systems
const LINUX_MDM_PATHS = [
    // System-wide configuration
    "/etc/continue/mdm.json",
    "/var/lib/continue/mdm.json",
    // User-specific configuration
    path.join(os.homedir(), ".config/continue/mdm.json"),
];
function readMdmKeysLinux() {
    try {
        // Try to find a valid MDM configuration file
        for (const mdmPath of LINUX_MDM_PATHS) {
            if (fs.existsSync(mdmPath)) {
                // Read the file content
                const fileContent = fs.readFileSync(mdmPath, "utf8");
                try {
                    // Parse the JSON configuration file
                    const config = JSON.parse(fileContent);
                    // Check if required key is present
                    if (config.licenseKey) {
                        return {
                            licenseKey: config.licenseKey,
                        };
                    }
                }
                catch (parseError) {
                    console.error(`Error parsing Linux MDM configuration: ${parseError}`);
                }
            }
        }
        return undefined;
    }
    catch (error) {
        console.error("Error reading Linux MDM keys:", error);
        return undefined;
    }
}
function readMdmKeys() {
    const platform = os.platform();
    switch (platform) {
        case "darwin":
            return readMdmKeysMacOS();
        case "win32":
            return readMdmKeysWindows();
        case "linux":
            return readMdmKeysLinux();
        default:
            console.error(`MDM keys not supported on platform: ${platform}`);
            return undefined;
    }
}
/**
 * Read and validate MDM keys from the operating system's configuration files or registry.
 */
function getLicenseKeyData() {
    try {
        const mdmKeys = readMdmKeys();
        if (mdmKeys) {
            const { isValid, licenseKeyData } = validateLicenseKey(mdmKeys.licenseKey);
            if (!isValid) {
                console.error("Invalid license key found: ", mdmKeys.licenseKey);
                return undefined;
            }
            return licenseKeyData;
        }
        return undefined;
    }
    catch (e) {
        console.warn("Error reading MDM keys: ", e);
        return undefined;
    }
}
function writeMdmKeysMacOS(licenseKey) {
    try {
        // Write to user-specific MDM plist
        const userMdmPath = path.join(os.homedir(), "Library/Managed Preferences/dev.continue.app.plist");
        const config = {
            licenseKey,
        };
        // Ensure directory exists
        fs.mkdirSync(path.dirname(userMdmPath), { recursive: true });
        // Write the plist file
        const plistContent = plist.build(config);
        fs.writeFileSync(userMdmPath, plistContent, "utf8");
        return true;
    }
    catch (error) {
        console.error("Error writing macOS MDM keys:", error);
        return false;
    }
}
function writeMdmKeysWindows(licenseKey) {
    try {
        const { execSync } = require("child_process");
        // Use HKEY_CURRENT_USER to avoid needing admin privileges
        const userRegPath = "HKCU\\Software\\Continue\\MDM";
        // Create the registry key if it doesn't exist
        try {
            execSync(`reg add "${userRegPath}" /f`);
        }
        catch (error) {
            // Key might already exist
        }
        // Set the license key and API URL
        execSync(`reg add "${userRegPath}" /v licenseKey /t REG_SZ /d "${licenseKey}" /f`);
        return true;
    }
    catch (error) {
        console.error("Error writing Windows MDM keys:", error);
        return false;
    }
}
function writeMdmKeysLinux(licenseKey) {
    try {
        // Write to user-specific configuration
        const userMdmPath = path.join(os.homedir(), ".config/continue/mdm.json");
        const config = {
            licenseKey,
        };
        // Ensure directory exists
        fs.mkdirSync(path.dirname(userMdmPath), { recursive: true });
        // Write the JSON configuration file
        fs.writeFileSync(userMdmPath, JSON.stringify(config, null, 2), "utf8");
        return true;
    }
    catch (error) {
        console.error("Error writing Linux MDM keys:", error);
        return false;
    }
}
/**
 * Store the license key in the appropriate OS-specific location.
 * For now, we'll use a default API URL since it's not provided in the command.
 */
function setMdmLicenseKey(licenseKey) {
    try {
        // Validate the license key first
        const { isValid } = validateLicenseKey(licenseKey);
        if (!isValid) {
            return false;
        }
        const platform = os.platform();
        switch (platform) {
            case "darwin":
                return writeMdmKeysMacOS(licenseKey);
            case "win32":
                return writeMdmKeysWindows(licenseKey);
            case "linux":
                return writeMdmKeysLinux(licenseKey);
            default:
                console.error(`Setting MDM keys not supported on platform: ${platform}`);
                return false;
        }
    }
    catch (error) {
        console.error("Error setting MDM license key:", error);
        return false;
    }
}
//# sourceMappingURL=mdm.js.map