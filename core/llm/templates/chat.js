"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zephyrTemplateMessages = exports.xWinCoderTemplateMessages = exports.templateAlpacaMessages = exports.phindTemplateMessages = exports.phi2TemplateMessages = exports.openchatTemplateMessages = exports.neuralChatTemplateMessages = exports.llavaTemplateMessages = exports.llama3TemplateMessages = exports.graniteTemplateMessages = exports.gemmaTemplateMessage = exports.chatmlTemplateMessages = void 0;
exports.anthropicTemplateMessages = anthropicTemplateMessages;
exports.codeLlama70bTemplateMessages = codeLlama70bTemplateMessages;
exports.deepseekTemplateMessages = deepseekTemplateMessages;
exports.llama2TemplateMessages = llama2TemplateMessages;
exports.codestralTemplateMessages = codestralTemplateMessages;
const messageContent_js_1 = require("../../util/messageContent.js");
function templateFactory(systemMessage, userPrompt, assistantPrompt, separator, prefix, emptySystemMessage) {
    return (msgs) => {
        let prompt = prefix ?? "";
        // Skip assistant messages at the beginning
        while (msgs.length > 0 && msgs[0].role === "assistant") {
            msgs.shift();
        }
        if (msgs.length > 0 && msgs[0].role === "system") {
            prompt += systemMessage(msgs.shift());
        }
        else if (emptySystemMessage) {
            prompt += emptySystemMessage;
        }
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            prompt += msg.role === "user" ? userPrompt : assistantPrompt;
            prompt += msg.content;
            if (i < msgs.length - 1) {
                prompt += separator;
            }
        }
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
            prompt += separator;
            prompt += assistantPrompt;
        }
        return prompt;
    };
}
/**
 * @description Template for LLAMA2 messages:
 *
 * <s>[INST] <<SYS>>
 * {{ system_prompt }}
 * <</SYS>>
 *
 * {{ user_msg_1 }} [/INST] {{ model_answer_1 }} </s><s>[INST] {{ user_msg_2 }} [/INST] {{ model_answer_2 }} </s><s>[INST] {{ user_msg_3 }} [/INST]
 */
function llama2TemplateMessages(msgs) {
    if (msgs.length === 0) {
        return "";
    }
    if (msgs[0].role === "assistant") {
        // These models aren't trained to handle assistant message coming first,
        // and typically these are just introduction messages from Continue
        msgs.shift();
    }
    let prompt = "";
    let hasSystem = msgs[0].role === "system";
    if (hasSystem && (0, messageContent_js_1.renderChatMessage)(msgs[0]).trim() === "") {
        hasSystem = false;
        msgs = msgs.slice(1);
    }
    if (hasSystem) {
        const systemMessage = `<<SYS>>\n ${msgs[0].content}\n<</SYS>>\n\n`;
        if (msgs.length > 1) {
            prompt += `<s>[INST] ${systemMessage} ${msgs[1].content} [/INST]`;
        }
        else {
            prompt += `[INST] ${systemMessage} [/INST]`;
            return prompt;
        }
    }
    for (let i = hasSystem ? 2 : 0; i < msgs.length; i++) {
        if (msgs[i].role === "user") {
            prompt += `[INST] ${msgs[i].content} [/INST]`;
        }
        else {
            prompt += msgs[i].content;
            if (i < msgs.length - 1) {
                prompt += "</s>\n<s>";
            }
        }
    }
    return prompt;
}
// Llama2 template with added \n to prevent Codestral from continuing user message
function codestralTemplateMessages(msgs) {
    let template = llama2TemplateMessages(msgs);
    if (template.length === 0) {
        return template;
    }
    return template + "\n";
}
function anthropicTemplateMessages(messages) {
    const HUMAN_PROMPT = "\n\nHuman:";
    const AI_PROMPT = "\n\nAssistant:";
    let prompt = "";
    // Anthropic prompt must start with a Human turn
    if (messages.length > 0 &&
        messages[0].role !== "user" &&
        messages[0].role !== "system") {
        prompt += `${HUMAN_PROMPT} Hello.`;
    }
    for (const msg of messages) {
        prompt += `${msg.role === "user" || msg.role === "system" ? HUMAN_PROMPT : AI_PROMPT} ${msg.content} `;
    }
    prompt += AI_PROMPT;
    return prompt;
}
`A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.
USER: <image>{prompt}
ASSISTANT:`;
const llavaTemplateMessages = templateFactory(() => "", "USER: <image>", "ASSISTANT: ", "\n", "A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.");
exports.llavaTemplateMessages = llavaTemplateMessages;
const zephyrTemplateMessages = templateFactory((msg) => `<|system|>${msg.content}</s>\n`, "<|user|>\n", "<|assistant|>\n", "</s>\n", undefined, "<|system|> </s>\n");
exports.zephyrTemplateMessages = zephyrTemplateMessages;
const chatmlTemplateMessages = templateFactory((msg) => `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`, "<|im_start|>user\n", "<|im_start|>assistant\n", "<|im_end|>\n");
exports.chatmlTemplateMessages = chatmlTemplateMessages;
const templateAlpacaMessages = templateFactory((msg) => `${msg.content}\n\n`, "### Instruction:\n", "### Response:\n", "\n\n", undefined, "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n");
exports.templateAlpacaMessages = templateAlpacaMessages;
function deepseekTemplateMessages(msgs) {
    let prompt = "";
    let system = null;
    prompt +=
        "You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your  role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n";
    if (msgs[0].role === "system") {
        system = (0, messageContent_js_1.renderChatMessage)(msgs.shift());
    }
    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        prompt += msg.role === "user" ? "### Instruction:\n" : "### Response:\n";
        if (system && msg.role === "user" && i === msgs.length - 1) {
            prompt += `${system}\n`;
        }
        prompt += `${msg.content}`;
        if (i < msgs.length - 1) {
            prompt += msg.role === "user" ? "\n" : "<|EOT|>\n";
        }
    }
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
        prompt += "\n";
        prompt += "### Response:\n";
    }
    return prompt;
}
// See https://huggingface.co/microsoft/phi-2#qa-format
const phi2TemplateMessages = templateFactory((msg) => `\n\nInstruct: ${msg.content} `, "\n\nInstruct: ", "\n\nOutput: ", " ");
exports.phi2TemplateMessages = phi2TemplateMessages;
const phindTemplateMessages = templateFactory((msg) => `### System Prompt\n${msg.content}\n\n`, "### User Message\n", "### Assistant\n", "\n");
exports.phindTemplateMessages = phindTemplateMessages;
/**
 * OpenChat Template, used by CodeNinja
 * GPT4 Correct User: Hello<|end_of_turn|>GPT4 Correct Assistant: Hi<|end_of_turn|>GPT4 Correct User: How are you today?<|end_of_turn|>GPT4 Correct Assistant:
 */
const openchatTemplateMessages = templateFactory(() => "", "GPT4 Correct User: ", "GPT4 Correct Assistant: ", "<|end_of_turn|>");
exports.openchatTemplateMessages = openchatTemplateMessages;
/**
 * Chat template used by https://huggingface.co/TheBloke/XwinCoder-13B-GPTQ
 *

<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.
<user>: {prompt}
<AI>:
 */
const xWinCoderTemplateMessages = templateFactory((msg) => `<system>: ${msg.content}`, "\n<user>: ", "\n<AI>: ", "", undefined, "<system>: You are an AI coding assistant that helps people with programming. Write a response that appropriately completes the user's request.");
exports.xWinCoderTemplateMessages = xWinCoderTemplateMessages;
/**
 * NeuralChat Template
 * ### System:\n{system_input}\n### User:\n{user_input}\n### Assistant:\n
 */
const neuralChatTemplateMessages = templateFactory((msg) => `### System:\n${msg.content}\n`, "### User:\n", "### Assistant:\n", "\n");
exports.neuralChatTemplateMessages = neuralChatTemplateMessages;
/**
'<s>Source: system\n\n System prompt <step> Source: user\n\n First user query <step> Source: assistant\n\n Model response to first query <step> Source: user\n\n Second user query <step> Source: assistant\nDestination: user\n\n '
 */
function codeLlama70bTemplateMessages(msgs) {
    let prompt = "<s>";
    for (const msg of msgs) {
        prompt += `Source: ${msg.role}\n\n ${(0, messageContent_js_1.renderChatMessage)(msg).trim()}`;
        prompt += " <step> ";
    }
    prompt += "Source: assistant\nDestination: user\n\n";
    return prompt;
}
const llama3TemplateMessages = templateFactory((msg) => `<|begin_of_text|><|start_header_id|>${msg.role}<|end_header_id|>\n${msg.content}<|eot_id|>\n`, "<|start_header_id|>user<|end_header_id|>\n", "<|start_header_id|>assistant<|end_header_id|>\n", "<|eot_id|>");
exports.llama3TemplateMessages = llama3TemplateMessages;
/**
 <start_of_turn>user
 What is Cramer's Rule?<end_of_turn>
 <start_of_turn>model
 */
const gemmaTemplateMessage = templateFactory(() => "", "<start_of_turn>user\n", "<start_of_turn>model\n", "<end_of_turn>\n");
exports.gemmaTemplateMessage = gemmaTemplateMessage;
const graniteTemplateMessages = templateFactory((msg) => (!!msg ? `\n\nSystem:\n ${msg.content}\n\n` : ""), "Question:\n", "Answer:\n", "\n\n", "", "");
exports.graniteTemplateMessages = graniteTemplateMessages;
//# sourceMappingURL=chat.js.map