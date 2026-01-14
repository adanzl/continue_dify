import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
  Tool,
} from "../../index.js";
import { BaseLLM } from "../index.js";
import { extractPathsFromCodeBlocks } from "../utils/extractPathsFromCodeBlocks.js";
import { extractContentFromCodeBlock } from "../utils/extractContentFromCodeBlocks.js";
import { renderChatMessage } from "../../util/messageContent.js";

/**
 * Dify API 响应类型定义
 * 参考: https://docs.dify.ai/api-reference
 */

/** SSE 事件基础类型 */
interface DifyBaseEvent {
  event: string;
  task_id?: string;
  message_id?: string;
  conversation_id?: string;
  created_at?: number;
}

/** 工具调用事件 */
interface DifyToolCallEvent extends DifyBaseEvent {
  event: "tool_calls";
  tool_calls: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/** 消息类型事件 (message, agent_message, agent_thought) */
interface DifyMessageEvent extends DifyBaseEvent {
  event: "message" | "agent_message" | "agent_thought";
  answer: string;
}

/** 文本块事件 */
interface DifyTextChunkEvent extends DifyBaseEvent {
  event: "text_chunk" | "text_replace";
  answer: string;
}

/** 消息结束事件 */
interface DifyMessageEndEvent extends DifyBaseEvent {
  event: "message_end";
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      total_price?: string;
      currency?: string;
      latency?: number;
    };
    retriever_resources?: Array<any>;
  };
}

/** Workflow 完成事件 */
interface DifyWorkflowFinishedEvent extends DifyBaseEvent {
  event: "workflow_finished";
  workflow_run_id: string;
  data: {
    id: string;
    workflow_id: string;
    status: "succeeded" | "failed" | "stopped";
    outputs?: Record<string, any>;
    error?: string;
    elapsed_time: number;
    total_tokens: number;
    total_steps: number;
    created_at: number;
    finished_at: number;
  };
}

/** 错误事件 */
interface DifyErrorEvent extends DifyBaseEvent {
  event: "error";
  code: string;
  message: string;
  status: number;
}

/** 所有 SSE 事件类型 */
type DifySSEEvent =
  | DifyMessageEvent
  | DifyTextChunkEvent
  | DifyMessageEndEvent
  | DifyWorkflowFinishedEvent
  | DifyToolCallEvent
  | DifyErrorEvent
  | DifyBaseEvent;

/** Dify 工具定义 */
interface DifyTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

/** Chat API 请求体 */
interface DifyChatRequest {
  query: string;
  inputs?: Record<string, any>;
  response_mode: "streaming" | "blocking";
  conversation_id?: string;
  user: string;
  tools?: DifyTool[];
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
}

/** Workflow API 请求体 */
interface DifyWorkflowRequest {
  inputs: Record<string, any>;
  response_mode: "streaming" | "blocking";
  user: string;
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
    upload_file_id?: string;
  }>;
}

/**
 * Dify LLM Provider
 * 
 * 支持 Dify 的 Chat 和 Workflow 应用
 * 
 * 配置示例:
 * ```yaml
 * models:
 *   - name: Dify Chat
 *     provider: dify
 *     model: chat           # 或 "workflow"
 *     apiKey: app-xxxxx
 *     apiBase: https://api.dify.ai/v1
 *     contextLength: 8000
 * ```
 * 
 * 参考文档: https://docs.dify.ai/api-reference
 */
class Dify extends BaseLLM {
  static providerName = "dify";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.dify.ai/v1",
    model: "chat",
    contextLength: 8000,
  };

  /** 存储会话ID，用于维持上下文（仅 Chat 模式） */
  private conversationId: string = "";

  /** 判断是否使用 Workflow API */
  private get isWorkflowMode(): boolean {
    return this.model?.toLowerCase() === "workflow";
  }

  /**
   * 提取用户消息作为 query
   * Chat API 使用最后一条用户消息作为 query 参数
   * 
   * 注意：只提取用户消息的纯文本内容，不包括系统消息或其他角色
   */
  private _extractQuery(messages: ChatMessage[]): string {
    // 从后往前查找最后一条用户消息
    // 跳过那些内容看起来像系统消息的消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") {
        const query = this._messageContentToString(msg.content);
        if (!query || query.length === 0) {
          continue;
        }

        // 检查是否错误地提取了系统消息
        // 如果 query 很长（>1000）且包含系统消息关键词，说明这条消息有问题
        const isSystemMessageContent =
          query.length > 1000 &&
          (query.includes("tool_use_instructions") ||
            query.includes("important_rules") ||
            query.includes("TOOL_NAME:") ||
            query.includes("You are in agent mode"));

        if (isSystemMessageContent) {
          // 这条消息看起来是系统消息，跳过它，继续查找
          continue;
        }

        // 找到有效的用户消息
        return query;
      }
    }

    return "";
  }

  /**
   * 转换消息内容为字符串
   * 
   * 注意：只提取文本内容，忽略其他类型（如图片）
   * 如果内容包含模板标记（如 `<|im_start|>`），说明消息被错误地模板化了
   */
  private _messageContentToString(content: MessageContent): string {
    if (typeof content === "string") {
      // 检查是否包含模板标记（说明消息被错误地模板化了）
      if (content.includes("<|im_start|>") || content.includes("<|im_end|>")) {
        // 尝试从模板格式中提取用户消息
        // ChatML 格式: <|im_start|>system\n...<|im_end|>\n<|im_start|>user\n...<|im_end|>
        const userMatch = content.match(/<\|im_start\|>user\s*\n(.*?)<\|im_end\|>/s);
        if (userMatch && userMatch[1]) {
          console.warn(
            `[Dify] Warning: Message content appears to be in template format. Extracting user message from template.`,
          );
          return userMatch[1].trim();
        }
        // 如果提取失败，返回原始内容（可能会失败，但至少不会丢失信息）
        console.error(
          `[Dify] Error: Failed to extract user message from template format. Content length: ${content.length}`,
        );
      }
      return content;
    }

    // 处理多模态内容（提取文本部分）
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (part.type === "text" && typeof part.text === "string") {
            return part.text;
          }
          // 忽略非文本内容
          return "";
        })
        .filter((text) => text.length > 0)
        .join("\n");
    }

    // 如果 content 既不是字符串也不是数组，返回空字符串
    return "";
  }

  /**
   * 从消息中提取上下文信息
   * 
   * 从用户消息中解析文件路径、代码内容、编程语言等信息
   */
  private _extractContextFromMessages(messages: ChatMessage[]): {
    file_path: string;
    file_content: string;
    selection: string;
    language: string;
    project_files: string;
    error_message: string;
  } {
    const context = {
      file_path: "",
      file_content: "",
      selection: "",
      language: "",
      project_files: "",
      error_message: "",
    };

    // 从最后一条用户消息中提取信息
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");

    if (!lastUserMessage) {
      return context;
    }

    const messageContent = renderChatMessage(lastUserMessage);

    // 提取文件路径（从代码块中）
    const filePaths = extractPathsFromCodeBlocks(messageContent);
    if (filePaths.length > 0) {
      context.file_path = filePaths[0]; // 使用第一个找到的文件路径

      // 提取文件内容
      const fileContent = extractContentFromCodeBlock(
        messageContent,
        filePaths[0],
      );
      if (fileContent) {
        context.file_content = fileContent;
        context.selection = fileContent; // 如果找到了代码块，也作为选中代码
      }

      // 从代码块中提取语言
      // 匹配格式: ```language filepath
      const languageMatch = messageContent.match(
        /```(\w+)\s+[^\s`]+/,
      );
      if (languageMatch && languageMatch[1]) {
        context.language = languageMatch[1];
      }
    }

    // 尝试从消息中提取错误信息
    // 查找常见的错误模式
    const errorPatterns = [
      /error[:\s]+([^\n]+)/i,
      /exception[:\s]+([^\n]+)/i,
      /failed[:\s]+([^\n]+)/i,
      /```(?:error|exception|stacktrace)[\s\S]*?```/i,
    ];

    for (const pattern of errorPatterns) {
      const match = messageContent.match(pattern);
      if (match) {
        context.error_message = match[1] || match[0];
        break;
      }
    }

    // 注意：project_files 需要从项目结构中提取，这里暂时留空
    // 未来可以通过 Continue 的上下文提供者获取

    return context;
  }

  /**
   * 构建 inputs 对象
   * 
   * 对于 Chat API: inputs 包含应用定义的变量（可选）
   * 对于 Workflow API: inputs 包含工作流需要的所有输入变量（必需）
   * 
   * 特殊情况：某些 Dify 应用配置了自定义输入表单，此时 query 
   * 也需要作为输入变量放入 inputs 中，而不是作为顶级参数
   * 
   * 注意: 
   * - 当提供 conversation_id 继续对话时，新的 inputs 会被忽略
   * - query 字段有长度限制（通常 5000 字符），只应包含用户消息
   * - 系统消息不应放入 inputs，Dify 应用有自己的系统提示词配置
   * - 从消息中提取上下文信息，为 Dify 应用提供更丰富的输入
   */
  private _buildInputs(
    messages: ChatMessage[],
    query: string,
  ): Record<string, any> {
    const inputs: Record<string, any> = {};

    // 对于 Workflow 模式或自定义输入表单的 Chat 应用，
    // query 需要放入 inputs
    // 为了兼容性，我们始终在 inputs 中包含 query
    // 注意：query 只包含用户消息，不包含系统消息（系统消息由 Dify 应用配置处理）
    inputs.query = query;

    // 从消息中提取上下文信息
    const context = this._extractContextFromMessages(messages);

    // 设置提取到的上下文信息，如果为空则使用空字符串
    // 这样可以避免模板引擎显示占位符（如 {% if start.file_path %}）
    inputs.file_path = context.file_path || "";
    inputs.file_content = context.file_content || "";
    inputs.selection = context.selection || "";
    inputs.language = context.language || "";
    inputs.project_files = context.project_files || "";
    inputs.error_message = context.error_message || "";

    // 注意：系统消息不应放入 inputs
    // Dify Chat API 通过应用配置中的系统提示词来处理系统消息
    // 如果需要在运行时传递系统消息，应该通过应用的提示词变量配置来实现

    return inputs;
  }

  /**
   * 验证并准备 query
   */
  private _validateAndPrepareQuery(messages: ChatMessage[]): string {
    const query = this._extractQuery(messages);
    if (!query) {
      // 提供更详细的错误信息
      const userMessages = messages.filter((m) => m.role === "user");
      const messageRoles = messages.map((m, i) => `${i}: ${m.role}`);
      throw new Error(
        `No valid user message found in the conversation. ` +
          `Found ${userMessages.length} user message(s), but all appear to contain system message content. ` +
          `Message roles: ${messageRoles.join(", ")}`,
      );
    }

    // 验证 query 长度（Dify 限制为 5000 字符）
    if (query.length > 5000) {
      throw new Error(
        `Query exceeds Dify's 5000 character limit: ${query.length} characters. Please shorten your message.`,
      );
    }

    return query;
  }

  /**
   * 构建请求 URL
   */
  private _buildRequestUrl(apiBase: string): string {
    const endpoint = this.isWorkflowMode ? "/workflows/run" : "/chat-messages";
    const baseUrl = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    const endpointPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${baseUrl}${endpointPath}`;
  }

  /**
   * 将 Continue 的工具定义转换为 Dify 格式
   */
  private _convertToolsToDifyFormat(tools: Tool[] | undefined): DifyTool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools
      .filter((tool) => tool.type === "function")
      .map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));
  }

  /**
   * 构建请求体
   */
  private _buildRequestBody(
    query: string,
    inputs: Record<string, any>,
    tools?: Tool[],
  ): DifyChatRequest | DifyWorkflowRequest {
    if (this.isWorkflowMode) {
      return {
        inputs,
        response_mode: "streaming",
        user: "continue-user",
      } as DifyWorkflowRequest;
    }

    const difyTools = this._convertToolsToDifyFormat(tools);

    return {
      query,
      inputs,
      response_mode: "streaming",
      conversation_id: this.conversationId || undefined,
      user: "continue-user",
      ...(difyTools && difyTools.length > 0 ? { tools: difyTools } : {}),
    } as DifyChatRequest;
  }

  /**
   * 构建请求头
   */
  private _buildRequestHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "User-Agent": "Continue-Dify/1.0",
    };

    // 合并 requestOptions 中的自定义请求头（如果存在）
    if (this.requestOptions?.headers) {
      Object.assign(headers, this.requestOptions.headers);
    }

    return headers;
  }

  /**
   * 处理 SSE 事件并生成消息
   */
  private async *_processSSEEvents(
    response: Response,
    signal: AbortSignal,
  ): AsyncGenerator<ChatMessage> {
    try {
      for await (const chunk of streamSse(response)) {
        const event = chunk as DifySSEEvent;

        // 调试日志：记录收到的事件
        if (process.env.DIFY_DEBUG === "true") {
          console.log("[Dify] Received event:", event.event, event);
        }

        // 保存会话ID（仅 Chat API）
        if (!this.isWorkflowMode && event.conversation_id) {
          this.conversationId = event.conversation_id;
        }

        // 处理不同的事件类型
        const message = this._handleSSEEvent(event);
        if (message) {
          yield message;
        }
      }
    } catch (error) {
      // 如果是取消信号，正常结束
      if (signal.aborted) {
        return;
      }
      throw error;
    }
  }

  /**
   * 处理单个 SSE 事件
   */
  private _handleSSEEvent(event: DifySSEEvent): ChatMessage | null {
    switch (event.event) {
      case "message":
      case "agent_message":
      case "agent_thought":
      case "text_chunk":
      case "text_replace": {
        const textEvent = event as DifyMessageEvent | DifyTextChunkEvent;
        if (textEvent.answer) {
          return {
            role: "assistant",
            content: textEvent.answer,
          };
        }
        break;
      }

      case "message_end": {
        const endEvent = event as DifyMessageEndEvent;
        // 可以在这里记录使用统计
        if (endEvent.metadata?.usage) {
          // console.log("Token usage:", endEvent.metadata.usage);
        }
        break;
      }

      case "workflow_finished": {
        const workflowEvent = event as DifyWorkflowFinishedEvent;
        
        // 如果配置的是 Chat 模式但收到了 workflow_finished 事件，说明后端配置可能有问题
        if (!this.isWorkflowMode) {
          console.warn(
            "[Dify] Received workflow_finished event in Chat mode. " +
            "This may indicate a backend configuration issue. " +
            "Your Dify app might be configured as a Workflow instead of Chat.",
          );
        }
        
        if (
          workflowEvent.data.status === "succeeded" &&
          workflowEvent.data.outputs
        ) {
          const answer =
            workflowEvent.data.outputs.answer ||
            workflowEvent.data.outputs.text ||
            workflowEvent.data.outputs.result;
          if (answer && typeof answer === "string") {
            return {
              role: "assistant",
              content: answer,
            };
          }
        } else if (workflowEvent.data.status === "failed") {
          const errorMsg = workflowEvent.data.error || "Unknown error";
          const reqId = workflowEvent.task_id || workflowEvent.message_id || "unknown";
          
          // 提供更详细的错误信息
          let fullErrorMsg = `Workflow failed: req_id: ${reqId} ${errorMsg}`;
          
          if (!this.isWorkflowMode) {
            fullErrorMsg += 
              "\n\n注意: 您配置的是 Chat 模式，但 Dify 后端返回了工作流错误。" +
              "这可能是因为:\n" +
              "1. Dify 应用被错误地配置为工作流模式\n" +
              "2. API Key 对应的应用类型不匹配\n" +
              "请检查 Dify 控制台中的应用类型配置。";
          }
          
          throw new Error(fullErrorMsg);
        }
        break;
      }

      case "tool_calls": {
        const toolCallEvent = event as DifyToolCallEvent;
        if (toolCallEvent.tool_calls && toolCallEvent.tool_calls.length > 0) {
          // 将 Dify 工具调用转换为 Continue 格式
          const toolCalls = toolCallEvent.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments || "{}",
            },
          }));

          return {
            role: "assistant",
            content: "",
            toolCalls,
          };
        }
        break;
      }

      case "error": {
        const errorEvent = event as DifyErrorEvent;
        throw new Error(
          `Dify error [${errorEvent.code}]: ${errorEvent.message}`,
        );
      }

      // 忽略其他事件类型（如 workflow_started, node_started 等）
      default:
        break;
    }

    return null;
  }

  /**
   * 流式聊天补全
   * 
   * 根据配置自动选择 Chat API 或 Workflow API
   */
  // eslint-disable-next-line complexity
  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // 确保 apiBase 不为 undefined
    const apiBase: string =
      this.apiBase ||
      (Dify.defaultOptions.apiBase as string) ||
      "https://api.dify.ai/v1";
    const apiKey = this.apiKey;

    if (!apiKey) {
      throw new Error(
        "Dify API key is required. Please set 'apiKey' in your configuration.",
      );
    }

    const query = this._validateAndPrepareQuery(messages);
    const url = this._buildRequestUrl(apiBase);
    const inputs = this._buildInputs(messages, query);
    const requestBody = this._buildRequestBody(query, inputs, options.tools);
    const headers = this._buildRequestHeaders(apiKey);

    // 调试日志：记录请求信息
    if (process.env.DIFY_DEBUG === "true") {
      console.log("[Dify] Request URL:", url);
      console.log("[Dify] Request mode:", this.isWorkflowMode ? "Workflow" : "Chat");
      console.log("[Dify] Request body:", JSON.stringify(requestBody, null, 2));
    }

    const response = await this.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Dify API error (${response.status}): ${errorText}`,
      );
    }

    // 处理 SSE 流式响应
    yield* this._processSSEEvents(response, signal);
  }

  /**
   * 流式文本补全
   * Dify 主要使用 Chat API，这里复用 _streamChat
   */
  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: prompt,
      },
    ];

    for await (const message of this._streamChat(messages, signal, options)) {
      if (typeof message.content === "string") {
        yield message.content;
      }
    }
  }

  /**
   * 重置会话（清除 conversation_id）
   */
  public resetConversation(): void {
    this.conversationId = "";
  }

  /**
   * 获取当前会话ID
   */
  public getConversationId(): string {
    return this.conversationId;
  }

  /**
   * 设置会话ID（用于恢复会话）
   */
  public setConversationId(conversationId: string): void {
    this.conversationId = conversationId;
  }
}

export default Dify;
