"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalContext = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const sharedConfig_1 = require("../config/sharedConfig");
const paths_1 = require("./paths");
/**
 * A way to persist global state
 */
class GlobalContext {
    update(key, value) {
        const filepath = (0, paths_1.getGlobalContextFilePath)();
        if (!node_fs_1.default.existsSync(filepath)) {
            node_fs_1.default.writeFileSync(filepath, JSON.stringify({ [key]: value }, null, 2));
        }
        else {
            const data = node_fs_1.default.readFileSync(filepath, "utf-8");
            let parsed;
            try {
                parsed = JSON.parse(data);
            }
            catch (e) {
                console.warn(`Error updating global context, attempting to salvage security-sensitive values: ${e}`);
                // Attempt to salvage security-sensitive values before deleting
                let salvaged = {};
                try {
                    // Try to partially parse the corrupted data to extract sharedConfig
                    const match = data.match(/"sharedConfig"\s*:\s*({[^}]*})/);
                    if (match) {
                        const sharedConfigObj = JSON.parse(match[1]);
                        const salvagedSharedConfig = (0, sharedConfig_1.salvageSharedConfig)(sharedConfigObj);
                        if (Object.keys(salvagedSharedConfig).length > 0) {
                            salvaged.sharedConfig = salvagedSharedConfig;
                        }
                    }
                }
                catch {
                    // If salvage fails, continue with empty salvaged object
                }
                // Delete the corrupted file and recreate it fresh
                try {
                    node_fs_1.default.unlinkSync(filepath);
                }
                catch (deleteError) {
                    console.warn(`Error deleting corrupted global context file: ${deleteError}`);
                }
                // Recreate the file with salvaged values plus the new value
                const newData = { ...salvaged, [key]: value };
                node_fs_1.default.writeFileSync(filepath, JSON.stringify(newData, null, 2));
                return;
            }
            parsed[key] = value;
            node_fs_1.default.writeFileSync(filepath, JSON.stringify(parsed, null, 2));
        }
    }
    get(key) {
        const filepath = (0, paths_1.getGlobalContextFilePath)();
        if (!node_fs_1.default.existsSync(filepath)) {
            return undefined;
        }
        const data = node_fs_1.default.readFileSync(filepath, "utf-8");
        try {
            const parsed = JSON.parse(data);
            return parsed[key];
        }
        catch (e) {
            console.warn(`Error parsing global context, deleting corrupted file: ${e}`);
            // Delete the corrupted file so it can be recreated fresh
            try {
                node_fs_1.default.unlinkSync(filepath);
            }
            catch (deleteError) {
                console.warn(`Error deleting corrupted global context file: ${deleteError}`);
            }
            return undefined;
        }
    }
    getSharedConfig() {
        const sharedConfig = this.get("sharedConfig") ?? {};
        const result = sharedConfig_1.sharedConfigSchema.safeParse(sharedConfig);
        if (result.success) {
            return result.data;
        }
        else {
            // in case of damaged shared config, repair it
            // Attempt to salvage any values that are security concerns
            console.error("Failed to load shared config, salvaging...", result.error);
            const salvagedConfig = (0, sharedConfig_1.salvageSharedConfig)(sharedConfig);
            this.update("sharedConfig", salvagedConfig);
            return salvagedConfig;
        }
    }
    updateSharedConfig(newValues) {
        const currentSharedConfig = this.getSharedConfig();
        const updatedSharedConfig = { ...currentSharedConfig, ...newValues };
        this.update("sharedConfig", updatedSharedConfig);
        return updatedSharedConfig;
    }
    updateSelectedModel(profileId, role, title) {
        const currentSelections = this.get("selectedModelsByProfileId") ?? {};
        const forProfile = currentSelections[profileId] ?? {};
        const newSelections = { ...forProfile, [role]: title };
        this.update("selectedModelsByProfileId", {
            ...currentSelections,
            [profileId]: newSelections,
        });
        return newSelections;
    }
}
exports.GlobalContext = GlobalContext;
//# sourceMappingURL=GlobalContext.js.map