"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextEditLoggingService = void 0;
const parameters_1 = require("../util/parameters");
const fetch_1 = require("@continuedev/fetch");
const env_1 = require("../control-plane/env");
const log_1 = require("../data/log");
const posthog_1 = require("../util/posthog");
class NextEditLoggingService {
    constructor() {
        // Key is completionId
        this._abortControllers = new Map();
        this._logRejectionTimeouts = new Map();
        this._outcomes = new Map();
        // Track minimal data for completions that get aborted before we have full outcome.
        this._pendingCompletions = new Map();
        this._lastDisplayedCompletion = undefined;
    }
    static getInstance() {
        if (!NextEditLoggingService.instance) {
            NextEditLoggingService.instance = new NextEditLoggingService();
        }
        return NextEditLoggingService.instance;
    }
    createAbortController(completionId) {
        const abortController = new AbortController();
        this._abortControllers.set(completionId, abortController);
        this.trackPendingCompletion(completionId);
        return abortController;
    }
    deleteAbortController(completionId) {
        this._abortControllers.delete(completionId);
        this._pendingCompletions.delete(completionId);
    }
    // Keep track of a new completion request.
    trackPendingCompletion(completionId) {
        this._pendingCompletions.set(completionId, {
            startTime: Date.now(),
        });
    }
    // Update pending completion info as it becomes available.
    updatePendingCompletion(completionId, data) {
        const pending = this._pendingCompletions.get(completionId);
        if (pending) {
            this._pendingCompletions.set(completionId, { ...pending, ...data });
        }
        else {
            // If we haven't tracked it yet, create new entry with provided data.
            this._pendingCompletions.set(completionId, {
                startTime: Date.now(),
                ...data,
            });
        }
    }
    cancel() {
        this._abortControllers.forEach((abortController, completionId) => {
            this.handleAbort(completionId);
            abortController.abort();
        });
        this._abortControllers.clear();
    }
    accept(completionId) {
        this._pendingCompletions.delete(completionId);
        if (this._logRejectionTimeouts.has(completionId)) {
            clearTimeout(this._logRejectionTimeouts.get(completionId));
            this._logRejectionTimeouts.delete(completionId);
        }
        if (this._outcomes.has(completionId)) {
            const outcome = this._outcomes.get(completionId);
            outcome.accepted = true;
            outcome.aborted = false;
            this.logNextEditOutcome(outcome);
            this._outcomes.delete(completionId);
            return outcome;
        }
    }
    reject(completionId) {
        this._pendingCompletions.delete(completionId);
        if (this._logRejectionTimeouts.has(completionId)) {
            clearTimeout(this._logRejectionTimeouts.get(completionId));
            this._logRejectionTimeouts.delete(completionId);
        }
        if (this._outcomes.has(completionId)) {
            const outcome = this._outcomes.get(completionId);
            outcome.accepted = false;
            outcome.aborted = false;
            this.logNextEditOutcome(outcome);
            this._outcomes.delete(completionId);
            return outcome;
        }
    }
    cancelRejectionTimeout(completionId) {
        if (this._logRejectionTimeouts.has(completionId)) {
            clearTimeout(this._logRejectionTimeouts.get(completionId));
            this._logRejectionTimeouts.delete(completionId);
        }
        if (this._outcomes.has(completionId)) {
            this._outcomes.delete(completionId);
        }
    }
    cancelRejectionTimeoutButKeepCompletionId(completionId) {
        if (this._logRejectionTimeouts.has(completionId)) {
            clearTimeout(this._logRejectionTimeouts.get(completionId));
        }
    }
    markDisplayed(completionId, outcome) {
        // Remove from pending since we now have full data.
        this._pendingCompletions.delete(completionId);
        outcome.aborted = false;
        const logRejectionTimeout = setTimeout(() => {
            // Wait 10 seconds, then assume it wasn't accepted
            outcome.accepted = false;
            outcome.aborted = false;
            this.logNextEditOutcome(outcome);
            this._logRejectionTimeouts.delete(completionId);
            this._outcomes.delete(completionId);
        }, parameters_1.COUNT_COMPLETION_REJECTED_AFTER);
        this._outcomes.set(completionId, outcome);
        this._logRejectionTimeouts.set(completionId, logRejectionTimeout);
        // If the previously displayed completion is still waiting for rejection,
        // and this one is a continuation of that (the outcome.completion is the same modulo prefix)
        // then we should cancel the rejection timeout
        const previous = this._lastDisplayedCompletion;
        const now = Date.now();
        if (previous && this._logRejectionTimeouts.has(previous.id)) {
            const previousOutcome = this._outcomes.get(previous.id);
            const c1 = previousOutcome?.completion.split("\n")[0] ?? "";
            const c2 = outcome.completion.split("\n")[0];
            if (previousOutcome &&
                (c1.endsWith(c2) ||
                    c2.endsWith(c1) ||
                    c1.startsWith(c2) ||
                    c2.startsWith(c1))) {
                this.cancelRejectionTimeout(previous.id);
            }
            else if (now - previous.displayedAt < 500) {
                // If a completion isn't shown for more than
                this.cancelRejectionTimeout(previous.id);
            }
        }
        this._lastDisplayedCompletion = {
            id: completionId,
            displayedAt: now,
        };
    }
    handleAbort(completionId) {
        // Clear any pending rejection timeout.
        if (this._logRejectionTimeouts.has(completionId)) {
            clearTimeout(this._logRejectionTimeouts.get(completionId));
            this._logRejectionTimeouts.delete(completionId);
        }
        // Only log if the completion was displayed to the user.
        // This aligns with Autocomplete behavior and prevents logging
        // of cancelled requests that never reached the user.
        if (this._outcomes.has(completionId)) {
            const outcome = this._outcomes.get(completionId);
            // outcome.accepted = false;
            outcome.aborted = true;
            this.logNextEditOutcome(outcome);
            this._outcomes.delete(completionId);
        }
        // Clean up.
        this._pendingCompletions.delete(completionId);
    }
    logNextEditOutcome(outcome) {
        if (outcome.aborted === undefined) {
            outcome.aborted = false;
        }
        void log_1.DataLogger.getInstance().logDevData({
            name: "nextEditOutcome",
            data: outcome,
            // data: {
            //   ...outcome, // TODO: this is somehow getting messed up with autocomplete schema.
            // },
        });
        // const { prompt, completion, prefix, suffix, ...restOfOutcome } = outcome;
        if (outcome.requestId && outcome.accepted !== undefined) {
            void this.logAcceptReject(outcome.requestId, outcome.accepted);
        }
        void posthog_1.Telemetry.capture("nextEditOutcome", outcome, true);
    }
    async logAcceptReject(requestId, accepted) {
        try {
            if (!posthog_1.Telemetry.client) {
                return;
            }
            const controlPlaneEnv = (0, env_1.getControlPlaneEnvSync)("production");
            const resp = await (0, fetch_1.fetchwithRequestOptions)(new URL("model-proxy/v1/feedback", controlPlaneEnv.CONTROL_PLANE_URL), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requestId,
                    accepted,
                }),
            });
            const text = await resp.text();
            console.debug("Feedback: ", text);
        }
        catch (error) {
            console.debug(`Error capturing feedback: ${error.message}`);
        }
    }
}
exports.NextEditLoggingService = NextEditLoggingService;
//# sourceMappingURL=NextEditLoggingService.js.map