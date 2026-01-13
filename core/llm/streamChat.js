"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmStreamChat = llmStreamChat;
const fetch_1 = require("@continuedev/fetch");
const usesFreeTrialApiKey_1 = require("../config/usesFreeTrialApiKey");
const posthog_1 = require("../util/posthog");
const tts_1 = require("../util/tts");
const starterCredits_1 = require("./utils/starterCredits");
async function* llmStreamChat(configHandler, abortController, msg, ide, messenger) {
    const { config } = await configHandler.loadConfig();
    if (!config) {
        throw new Error("Config not loaded");
    }
    // Stop TTS on new StreamChat
    if (config.experimental?.readResponseTTS) {
        void tts_1.TTS.kill();
    }
    const { legacySlashCommandData, completionOptions, messages, messageOptions, } = msg.data;
    const model = config.selectedModelByRole.chat;
    if (!model) {
        throw new Error("No chat model selected");
    }
    // Log to return in case of error
    const errorPromptLog = {
        modelTitle: model?.title ?? model?.model,
        modelProvider: model?.underlyingProviderName ?? "unknown",
        completion: "",
        prompt: "",
        completionOptions: {
            ...msg.data.completionOptions,
            model: model?.model,
        },
    };
    try {
        if (legacySlashCommandData) {
            const { command, contextItems, historyIndex, input, selectedCode } = legacySlashCommandData;
            const slashCommand = config.slashCommands?.find((sc) => sc.name === command.name);
            if (!slashCommand) {
                throw new Error(`Unknown slash command ${command.name}`);
            }
            if (!slashCommand.run) {
                console.error(`Slash command ${command.name} (${command.source}) has no run function`);
                throw new Error(`Slash command not found`);
            }
            const gen = slashCommand.run({
                input,
                history: messages,
                llm: model,
                contextItems,
                params: command.params,
                ide,
                addContextItem: (item) => {
                    void messenger.request("addContextItem", {
                        item,
                        historyIndex,
                    });
                },
                selectedCode,
                config,
                fetch: (url, init) => (0, fetch_1.fetchwithRequestOptions)(url, {
                    ...init,
                    signal: abortController.signal,
                }, model.requestOptions),
                completionOptions,
                abortController,
            });
            let next = await gen.next();
            while (!next.done) {
                if (abortController.signal.aborted) {
                    next = await gen.return(errorPromptLog);
                    break;
                }
                if (next.value) {
                    yield {
                        role: "assistant",
                        content: next.value,
                    };
                }
                next = await gen.next();
            }
            if (!next.done) {
                throw new Error("Will never happen");
            }
            return next.value;
        }
        else {
            const gen = model.streamChat(messages, abortController.signal, completionOptions, messageOptions);
            let next = await gen.next();
            while (!next.done) {
                if (abortController.signal.aborted) {
                    next = await gen.return(errorPromptLog);
                    break;
                }
                const chunk = next.value;
                yield chunk;
                next = await gen.next();
            }
            if (config.experimental?.readResponseTTS && "completion" in next.value) {
                void tts_1.TTS.read(next.value?.completion);
            }
            void posthog_1.Telemetry.capture("chat", {
                model: model.model,
                provider: model.providerName,
            }, true);
            void checkForOutOfStarterCredits(configHandler, messenger);
            if (!next.done) {
                throw new Error("Will never happen");
            }
            return next.value;
        }
    }
    catch (error) {
        // Moved error handling that was here to GUI, keeping try/catch for clean diff
        throw error;
    }
}
async function checkForOutOfStarterCredits(configHandler, messenger) {
    try {
        const { config } = await configHandler.getSerializedConfig();
        const creditStatus = await configHandler.controlPlaneClient.getCreditStatus();
        if (config &&
            creditStatus &&
            (0, starterCredits_1.isOutOfStarterCredits)((0, usesFreeTrialApiKey_1.usesCreditsBasedApiKey)(config), creditStatus)) {
            void messenger.request("freeTrialExceeded", undefined);
        }
    }
    catch (error) {
        console.error("Error checking free trial status:", error);
    }
}
//# sourceMappingURL=streamChat.js.map