"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentHistoryTracker = void 0;
/**
 * Singleton class that keeps track of a map of document paths to their history.
 * The point here is to prevent re-calculating the AST,
 * and to preserve an older, original state of the document before any user edits.
 */
class DocumentHistoryTracker {
    constructor() {
        this.documentAstMap = new Map();
        this.documentContentHistoryMap = new Map();
    }
    /**
     * Get the singleton instance of DocumentHistoryTracker.
     */
    static getInstance() {
        if (!DocumentHistoryTracker.instance) {
            DocumentHistoryTracker.instance = new DocumentHistoryTracker();
        }
        return DocumentHistoryTracker.instance;
    }
    /**
     * Add a document and its first state to the tracker.
     *
     * @param documentPath The path of the document.
     * @param documentContent The first content of the document.
     * @param ast The first AST of the document.
     */
    addDocument(documentPath, documentContent, ast) {
        this.documentAstMap.set(documentPath, [ast]);
        this.documentContentHistoryMap.set(documentPath, [documentContent]);
    }
    /**
     * Push a new AST to an existing document's history stack.
     *
     * @param documentPath The path of the document.
     * @param documentContent The new content to push to the document's history stack.
     * @param ast The new AST to push to the document's history stack.
     * @throws Error if the document doesn't exist in the tracker.
     */
    push(documentPath, documentContent, ast) {
        const astHistory = this.documentAstMap.get(documentPath);
        const documentHistory = this.documentContentHistoryMap.get(documentPath);
        if (!astHistory || !documentHistory) {
            console.error(`Document ${documentPath} not found in AST tracker`);
            this.addDocument(documentPath, documentContent, ast);
            return; // Early return - document was added with initial state
        }
        // Only execute this if the arrays already existed
        astHistory.unshift(ast);
        documentHistory.unshift(documentContent);
    }
    /**
     * Get the most recent AST of a document.
     *
     * @param documentPath The path of the document.
     * @returns The most recent AST of the document.
     * @throws Error if the document doesn't exist in the tracker.
     */
    getMostRecentAst(documentPath) {
        const astHistory = this.documentAstMap.get(documentPath);
        if (!astHistory) {
            console.error(`Document ${documentPath} not found in AST tracker`);
            return null;
        }
        if (astHistory.length === 0) {
            console.error(`Document ${documentPath} has no ASTs`);
            return null;
        }
        // Return the first element (most recent AST).
        return astHistory[0];
    }
    /**
     * Get the most recent AST of a document.
     *
     * @param documentPath The path of the document.
     * @returns The most recent document history of the document.
     * @throws Error if the document doesn't exist in the tracker.
     */
    getMostRecentDocumentHistory(documentPath) {
        const documentHistory = this.documentContentHistoryMap.get(documentPath);
        if (!documentHistory) {
            console.error(`Document ${documentPath} not found in AST tracker`);
            return null;
        }
        if (documentHistory.length === 0) {
            console.error(`Document ${documentPath} has no history`);
            return null;
        }
        // Return the first element (most recent doc history).
        return documentHistory[0];
    }
    /**
     * Delete a document from the tracker.
     *
     * @param documentPath The path of the document to delete.
     */
    deleteDocument(documentPath) {
        this.documentAstMap.delete(documentPath);
        this.documentContentHistoryMap.delete(documentPath);
    }
    /**
     * Clear all documents from the tracker.
     */
    clearMap() {
        this.documentAstMap.clear();
        this.documentContentHistoryMap.clear();
    }
}
exports.DocumentHistoryTracker = DocumentHistoryTracker;
DocumentHistoryTracker.instance = null;
//# sourceMappingURL=DocumentHistoryTracker.js.map