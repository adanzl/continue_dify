"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionStreamer = void 0;
const StreamTransformPipeline_1 = require("../filtering/streamTransforms/StreamTransformPipeline");
const GeneratorReuseManager_1 = require("./GeneratorReuseManager");
const utils_1 = require("./utils");
class CompletionStreamer {
    constructor(onError) {
        this.streamTransformPipeline = new StreamTransformPipeline_1.StreamTransformPipeline();
        this.generatorReuseManager = new GeneratorReuseManager_1.GeneratorReuseManager(onError);
    }
    async *streamCompletionWithFilters(token, llm, prefix, suffix, prompt, multiline, completionOptions, helper) {
        // Full stop means to stop the LLM's generation, instead of just truncating the displayed completion
        const fullStop = () => this.generatorReuseManager.currentGenerator?.cancel();
        // Try to reuse pending requests if what the user typed matches start of completion
        const generator = this.generatorReuseManager.getGenerator(prefix, (abortSignal) => {
            const generator = llm.supportsFim()
                ? llm.streamFim(prefix, suffix, abortSignal, completionOptions)
                : llm.streamComplete(prompt, abortSignal, {
                    ...completionOptions,
                    raw: true,
                });
            /**
             * This transformer applies even on reused generator. We are deliberately
             * not using streamTransformPipeline because we want to capture and stop
             * the request even if the generator is being reused.
             */
            return helper.options.transform
                ? (0, utils_1.stopAfterMaxProcessingTime)(generator, helper.options.modelTimeout * 2.5, fullStop)
                : generator;
        }, multiline);
        // LLM
        const generatorWithCancellation = async function* () {
            for await (const update of generator) {
                if (token.aborted) {
                    return;
                }
                yield update;
            }
        };
        const initialGenerator = generatorWithCancellation();
        const transformedGenerator = helper.options.transform
            ? this.streamTransformPipeline.transform(initialGenerator, prefix, suffix, multiline, completionOptions?.stop || [], fullStop, helper)
            : initialGenerator;
        for await (const update of transformedGenerator) {
            yield update;
        }
    }
}
exports.CompletionStreamer = CompletionStreamer;
//# sourceMappingURL=CompletionStreamer.js.map