"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListenableGenerator = void 0;
class ListenableGenerator {
    constructor(source, onError, abortController) {
        this.onError = onError;
        this._buffer = [];
        this._listeners = new Set();
        this._isEnded = false;
        this._source = source;
        this._abortController = abortController;
        this._start().catch((e) => console.log(`Listenable generator failed: ${e.message}`));
    }
    cancel() {
        this._abortController.abort();
        this._isEnded = true;
    }
    async _start() {
        try {
            for await (const value of this._source) {
                if (this._isEnded) {
                    break;
                }
                this._buffer.push(value);
                for (const listener of this._listeners) {
                    listener(value);
                }
            }
        }
        catch (e) {
            this.onError(e);
        }
        finally {
            this._isEnded = true;
            for (const listener of this._listeners) {
                listener(null);
            }
        }
    }
    listen(listener) {
        this._listeners.add(listener);
        for (const value of this._buffer) {
            listener(value);
        }
        if (this._isEnded) {
            listener(null);
        }
    }
    async *tee() {
        try {
            let i = 0;
            while (i < this._buffer.length) {
                yield this._buffer[i++];
            }
            while (!this._isEnded) {
                let resolve;
                const promise = new Promise((res) => {
                    resolve = res;
                    this._listeners.add(resolve);
                });
                await promise;
                this._listeners.delete(resolve);
                // Possible timing caused something to slip in between
                // timers so we iterate over the buffer
                while (i < this._buffer.length) {
                    yield this._buffer[i++];
                }
            }
        }
        finally {
            // this._listeners.delete(resolve!);
        }
    }
}
exports.ListenableGenerator = ListenableGenerator;
//# sourceMappingURL=ListenableGenerator.js.map