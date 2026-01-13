"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyAbortManager = void 0;
class ApplyAbortManager {
    constructor() {
        this.controllers = new Map();
    }
    static getInstance() {
        if (!ApplyAbortManager.instance) {
            ApplyAbortManager.instance = new ApplyAbortManager();
        }
        return ApplyAbortManager.instance;
    }
    get(id) {
        let controller = this.controllers.get(id);
        if (!controller) {
            controller = new AbortController();
            this.controllers.set(id, controller);
        }
        return controller;
    }
    abort(id) {
        const controller = this.controllers.get(id);
        if (controller) {
            controller.abort();
            this.controllers.delete(id);
        }
    }
    clear() {
        this.controllers.forEach((controller) => controller.abort());
        this.controllers.clear();
    }
}
exports.ApplyAbortManager = ApplyAbortManager;
//# sourceMappingURL=applyAbortManager.js.map