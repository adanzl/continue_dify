"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLanceMigrations = runLanceMigrations;
exports.runSqliteMigrations = runSqliteMigrations;
const paths_js_1 = require("../../util/paths.js");
const DocsService_js_1 = __importDefault(require("./DocsService.js"));
async function runLanceMigrations(table) {
    await new Promise((resolve) => {
        void (0, paths_js_1.migrate)("rename_baseurl_column_for_lance_docs", async () => {
            try {
                const schema = await table.schema;
                if (schema.fields.some((field) => field.name === "baseurl")) {
                    await table.alterColumns([{ path: "baseurl", rename: "starturl" }]);
                }
            }
            finally {
                resolve(undefined);
            }
        }, () => resolve(undefined));
    });
}
async function runSqliteMigrations(db) {
    await new Promise((resolve) => {
        void (0, paths_js_1.migrate)("sqlite_modify_docs_columns_and_copy_to_config", async () => {
            try {
                const pragma = await db.all(`PRAGMA table_info(${DocsService_js_1.default.sqlitebTableName});`);
                const hasFaviconCol = pragma.some((pragma) => pragma.name === "favicon");
                if (!hasFaviconCol) {
                    await db.exec(`ALTER TABLE ${DocsService_js_1.default.sqlitebTableName} ADD COLUMN favicon BLOB;`);
                }
                const hasBaseUrlCol = pragma.some((pragma) => pragma.name === "baseUrl");
                if (hasBaseUrlCol) {
                    await db.exec(`ALTER TABLE ${DocsService_js_1.default.sqlitebTableName} RENAME COLUMN baseUrl TO startUrl;`);
                }
                const needsToUpdateConfig = !hasFaviconCol || hasBaseUrlCol;
                if (needsToUpdateConfig) {
                    const sqliteDocs = await db.all(`SELECT title, startUrl FROM ${DocsService_js_1.default.sqlitebTableName}`);
                    (0, paths_js_1.editConfigFile)((config) => ({
                        ...config,
                        docs: [...(config.docs || []), ...sqliteDocs],
                    }), (config) => ({
                        ...config,
                        docs: [
                            ...(config.docs || []),
                            ...sqliteDocs.map((doc) => ({
                                name: doc.title,
                                startUrl: doc.startUrl,
                            })),
                        ],
                    }));
                }
            }
            finally {
                resolve(undefined);
            }
        }, () => resolve(undefined));
    });
    await new Promise((resolve) => {
        void (0, paths_js_1.migrate)("sqlite_delete_docs_with_no_embeddingsProviderId", async () => {
            try {
                const pragma = await db.all(`PRAGMA table_info(${DocsService_js_1.default.sqlitebTableName});`);
                const hasEmbeddingsProviderColumn = pragma.some((pragma) => pragma.name === "embeddingsProviderId");
                if (!hasEmbeddingsProviderColumn) {
                    // gotta just delete in this case since old docs will be unusable anyway
                    await db.exec(`DROP TABLE ${DocsService_js_1.default.sqlitebTableName};`);
                }
            }
            finally {
                resolve(undefined);
            }
        }, () => resolve(undefined));
    });
}
//# sourceMappingURL=migrations.js.map