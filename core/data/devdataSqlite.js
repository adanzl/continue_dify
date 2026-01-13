"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevDataSqliteDb = void 0;
const fs_1 = __importDefault(require("fs"));
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
const paths_js_1 = require("../util/paths.js");
/* The Dev Data SQLITE table is only used for local tokens generated */
class DevDataSqliteDb {
    static async createTables(db) {
        await db.exec(`CREATE TABLE IF NOT EXISTS tokens_generated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            tokens_generated INTEGER NOT NULL,
            tokens_prompt INTEGER NOT NULL DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        // Add tokens_prompt column if it doesn't exist
        const columnCheckResult = await db.all("PRAGMA table_info(tokens_generated);");
        const columnExists = columnCheckResult.some((col) => col.name === "tokens_prompt");
        if (!columnExists) {
            await db.exec("ALTER TABLE tokens_generated ADD COLUMN tokens_prompt INTEGER NOT NULL DEFAULT 0;");
        }
    }
    static async logTokensGenerated(model, provider, promptTokens, generatedTokens) {
        const db = await DevDataSqliteDb.get();
        await db?.run("INSERT INTO tokens_generated (model, provider, tokens_prompt, tokens_generated) VALUES (?, ?, ?, ?)", [model, provider, promptTokens, generatedTokens]);
    }
    static async getTokensPerDay() {
        const db = await DevDataSqliteDb.get();
        const result = await db?.all(
        // Return a sum of tokens_generated and tokens_prompt columns aggregated by day
        `SELECT date(timestamp) as day, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY date(timestamp)`);
        return result ?? [];
    }
    static async getTokensPerModel() {
        const db = await DevDataSqliteDb.get();
        const result = await db?.all(
        // Return a sum of tokens_generated and tokens_prompt columns aggregated by model
        `SELECT model, sum(tokens_prompt) as promptTokens, sum(tokens_generated) as generatedTokens
        FROM tokens_generated
        GROUP BY model`);
        return result ?? [];
    }
    static async get() {
        const devDataSqlitePath = (0, paths_js_1.getDevDataSqlitePath)();
        if (DevDataSqliteDb.db && fs_1.default.existsSync(devDataSqlitePath)) {
            return DevDataSqliteDb.db;
        }
        DevDataSqliteDb.db = await (0, sqlite_1.open)({
            filename: devDataSqlitePath,
            driver: sqlite3_1.default.Database,
        });
        await DevDataSqliteDb.db.exec("PRAGMA busy_timeout = 3000;");
        await DevDataSqliteDb.createTables(DevDataSqliteDb.db);
        return DevDataSqliteDb.db;
    }
}
exports.DevDataSqliteDb = DevDataSqliteDb;
DevDataSqliteDb.db = null;
//# sourceMappingURL=devdataSqlite.js.map