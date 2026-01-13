"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicySingleton = void 0;
class PolicySingleton {
    constructor() {
        this.policy = null;
    }
    static getInstance() {
        if (!PolicySingleton.instance) {
            PolicySingleton.instance = new PolicySingleton();
        }
        return PolicySingleton.instance;
    }
}
exports.PolicySingleton = PolicySingleton;
//# sourceMappingURL=PolicySingleton.js.map