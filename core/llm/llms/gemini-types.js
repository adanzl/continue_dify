"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertContinueToolToGeminiFunction = convertContinueToolToGeminiFunction;
const jsonSchemaTypeToGeminiType = (jsonSchemaType) => {
    switch (jsonSchemaType.toLowerCase()) {
        case "string":
            return "STRING";
        case "object":
            return "OBJECT";
        case "number":
            return "NUMBER";
        case "integer":
            return "INTEGER";
        case "array":
            return "ARRAY";
        case "boolean":
            return "BOOLEAN";
        default:
            return "TYPE_UNSPECIFIED";
    }
};
function convertJsonSchemaToGeminiSchema(jsonSchema) {
    const jsonSchemaType = jsonSchema["type"];
    if (!jsonSchemaType || typeof jsonSchema.type !== "string") {
        throw new Error(`Invalid type property in function declaration\n${JSON.stringify(jsonSchema, null, 2)}`);
    }
    const geminiSchema = {
        type: jsonSchemaTypeToGeminiType(jsonSchemaType),
    };
    // if (jsonSchema.format) geminiSchema.format = jsonSchema.format;
    if (jsonSchema.title)
        geminiSchema.title = jsonSchema.title;
    if (jsonSchema.description)
        geminiSchema.description = jsonSchema.description;
    // Handle nullable
    if (jsonSchemaType === "null" || jsonSchema.nullable) {
        geminiSchema.nullable = true;
    }
    // Handle enum values
    if (Array.isArray(jsonSchema.enum)) {
        geminiSchema.enum = jsonSchema.enum.map(String);
    }
    // Handle array constraints
    if (jsonSchemaType === "array") {
        if (typeof jsonSchema.maxItems !== "undefined") {
            geminiSchema.maxItems = String(jsonSchema.maxItems);
        }
        if (typeof jsonSchema.minItems !== "undefined") {
            geminiSchema.minItems = String(jsonSchema.minItems);
        }
        // Handle array items
        if (jsonSchema.items) {
            geminiSchema.items = convertJsonSchemaToGeminiSchema(jsonSchema.items);
        }
    }
    // Handle numeric constraints
    if (typeof jsonSchema.minimum !== "undefined") {
        geminiSchema.minimum = Number(jsonSchema.minimum);
    }
    if (typeof jsonSchema.maximum !== "undefined") {
        geminiSchema.maximum = Number(jsonSchema.maximum);
    }
    // Handle properties for objects
    if (jsonSchema.properties) {
        geminiSchema.properties = {};
        for (const [key, value] of Object.entries(jsonSchema.properties)) {
            geminiSchema.properties[key] = convertJsonSchemaToGeminiSchema(value);
        }
    }
    // Handle required properties
    if (Array.isArray(jsonSchema.required)) {
        geminiSchema.required = jsonSchema.required;
    }
    // Handle anyOf
    if (Array.isArray(jsonSchema.anyOf)) {
        geminiSchema.anyOf = jsonSchema.anyOf.map(convertJsonSchemaToGeminiSchema);
    }
    // TODO/UNSUPPORTED:
    // format
    // property ordering:
    // if (Array.isArray(jsonSchema.propertyOrdering)) {
    //   geminiSchema.propertyOrdering = jsonSchema.propertyOrdering;
    // }
    return geminiSchema;
}
// https://ai.google.dev/api/caching#FunctionDeclaration
// Note "reponse" field (schema showing function output structure) is not supported at the moment
function convertContinueToolToGeminiFunction(tool) {
    if (!tool.function.name) {
        throw new Error("Function name required");
    }
    const description = tool.function.description ?? "";
    const name = tool.function.name;
    const fn = {
        description,
        name,
    };
    if (tool.function.parameters &&
        "type" in tool.function.parameters &&
        typeof tool.function.parameters.type === "string") {
        // Gemini can't take an empty object
        // So if empty object param is present just don't add parameters
        if (tool.function.parameters.type === "object") {
            if (JSON.stringify(tool.function.parameters.properties) === "{}") {
                return fn;
            }
        }
        fn.parameters = convertJsonSchemaToGeminiSchema(tool.function.parameters);
    }
    return fn;
}
var BlockReason;
(function (BlockReason) {
    BlockReason["BLOCK_REASON_UNSPECIFIED"] = "BLOCK_REASON_UNSPECIFIED";
    BlockReason["SAFETY"] = "SAFETY";
    BlockReason["OTHER"] = "OTHER";
    BlockReason["BLOCKLIST"] = "BLOCKLIST";
    BlockReason["PROHIBITED_CONTENT"] = "PROHIBITED_CONTENT";
})(BlockReason || (BlockReason = {}));
var HarmCategory;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
    HarmCategory["HARM_CATEGORY_DEROGATORY"] = "HARM_CATEGORY_DEROGATORY";
    HarmCategory["HARM_CATEGORY_TOXICITY"] = "HARM_CATEGORY_TOXICITY";
    HarmCategory["HARM_CATEGORY_VIOLENCE"] = "HARM_CATEGORY_VIOLENCE";
    HarmCategory["HARM_CATEGORY_SEXUAL"] = "HARM_CATEGORY_SEXUAL";
    HarmCategory["HARM_CATEGORY_MEDICAL"] = "HARM_CATEGORY_MEDICAL";
    HarmCategory["HARM_CATEGORY_DANGEROUS"] = "HARM_CATEGORY_DANGEROUS";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
    HarmCategory["HARM_CATEGORY_CIVIC_INTEGRITY"] = "HARM_CATEGORY_CIVIC_INTEGRITY";
})(HarmCategory || (HarmCategory = {}));
var HarmProbability;
(function (HarmProbability) {
    HarmProbability["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
    HarmProbability["NEGLIGIBLE"] = "NEGLIGIBLE";
    HarmProbability["LOW"] = "LOW";
    HarmProbability["MEDIUM"] = "MEDIUM";
    HarmProbability["HIGH"] = "HIGH";
})(HarmProbability || (HarmProbability = {}));
var FinishReason;
(function (FinishReason) {
    FinishReason["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
    FinishReason["STOP"] = "STOP";
    FinishReason["MAX_TOKENS"] = "MAX_TOKENS";
    FinishReason["SAFETY"] = "SAFETY";
    FinishReason["RECITATION"] = "RECITATION";
    FinishReason["LANGUAGE"] = "LANGUAGE";
    FinishReason["OTHER"] = "OTHER";
    FinishReason["BLOCKLIST"] = "BLOCKLIST";
    FinishReason["PROHIBITED_CONTENT"] = "PROHIBITED_CONTENT";
    FinishReason["SPII"] = "SPII";
    FinishReason["MALFORMED_FUNCTION_CALL"] = "MALFORMED_FUNCTION_CALL";
})(FinishReason || (FinishReason = {}));
//# sourceMappingURL=gemini-types.js.map