"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContinueTeamMember = isContinueTeamMember;
/**
 * Utility to check if a user is a Continue team member
 */
function isContinueTeamMember(email) {
    if (!email)
        return false;
    return email.endsWith("@continue.dev");
}
//# sourceMappingURL=isContinueTeamMember.js.map