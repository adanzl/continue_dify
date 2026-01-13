import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index.js";
import { BaseLLM } from "../index.js";

/**
 * Dify API Response Types
 */
interface DifyStreamChunk {
  event: string;
  task_id?: string;
  message_id?: string;
  conversation_id?: string;
  answer?: string;
  created_at?: number;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

interface DifyCompletionRequest {
  inputs: Record<string, any>;
  query?: string;
  response_mode: "streaming" | "blocking";
  conversation_id?: string;
  user: string;
  files?: Array<{
    type: string;
    transfer_method: string;
    url?: string;
  }>;
}

interface DifyWorkflowRequest {
  inputs: Record<string, any>;
  response_mode: "streaming" | "blocking";
  user: string;
}

/**
 * Dify LLM Provider
 * 
 * 支持 Dify 的 Chat API 和 Workflow API
 * 
 * 配置示例:
 * ```json
 * {
 *   "title": "Dify Chat",
 *   "provider": "dify",
 *   "model": "chat",  // 或 "workflow"
 *   "apiKey": "app-xxxxxxxxxxxxx",
 *   "apiBase": "https://api.dify.ai/v1",
 *   "contextLength": 8000
 * }
 * ```
 */
class Dify extends BaseLLM {
  static providerName = "dify";
  
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.dify.ai/v1",
    model: "chat",
    contextLength: 8000,
  };

  // 存储会话ID，用于维持上下文
  private conversationId: string = "";
  
  // 判断是否使用 Workflow API
  private get isWorkflowMode(): boolean {
    return this.model?.toLowerCase() === "workflow";
  }

  /**
   * 转换消息格式
   * Dify API 主要使用最后一条用户消息作为 query
   */
  private _convertMessages(messages: ChatMessage[]): string {
    // 找到最后一条用户消息
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");

    if (!lastUserMessage) {
      return "";
    }

    // 处理消息内容
    if (typeof lastUserMessage.content === "string") {
      return lastUserMessage.content;
    }

    // 处理多模态内容（提取文本部分）
    return lastUserMessage.content
      .map((part) => {
        if (part.type === "text") {
          return part.text;
        }
        return "";
      })
      .filter((text) => text.length > 0)
      .join("\n");
  }

  /**
   * 提取系统消息和上下文
   */
  private _extractInputs(messages: ChatMessage[]): Record<string, any> {
    const inputs: Record<string, any> = {};

    // 提取系统消息
    const systemMessage = messages.find((msg) => msg.role === "system");
    if (systemMessage && typeof systemMessage.content === "string") {
      inputs.system_message = systemMessage.content;
    }

    // 提取历史对话（除了最后一条用户消息）
    const history = messages
      .slice(0, -1)
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("\n"),
      }));

    if (history.length > 0) {
      inputs.history = JSON.stringify(history);
    }

    return inputs;
  }

  /**
   * 流式聊天补全
   */
  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiBase = this.apiBase || Dify.defaultOptions.apiBase;
    const apiKey = this.apiKey;

    if (!apiKey) {
      throw new Error("Dify API key is required. Please set 'apiKey' in your config.");
    }

    const query = this._convertMessages(messages);
    if (!query) {
      throw new Error("No user message found in the conversation.");
    }

    // 构造请求体
    const endpoint = this.isWorkflowMode ? "/workflows/run" : "/chat-messages";
    
    let requestBody: DifyCompletionRequest | DifyWorkflowRequest;

    if (this.isWorkflowMode) {
      // Workflow API 请求
      requestBody = {
        inputs: {
          query,
          ...this._extractInputs(messages),
        },
        response_mode: "streaming",
        user: "continue-vscode-user",
      };
    } else {
      // Chat API 请求
      requestBody = {
        inputs: this._extractInputs(messages),
        query,
        response_mode: "streaming",
        conversation_id: this.conversationId,
        user: "continue-vscode-user",
      };
    }

    // 发送请求
    const response = await this.fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
    let fullContent = "";
    
    try {
      for await (const chunk of streamSse(response)) {
        const data = chunk as DifyStreamChunk;

        // 保存会话ID（仅 Chat API）
        if (!this.isWorkflowMode && data.conversation_id) {
          this.conversationId = data.conversation_id;
        }

        // 处理不同的事件类型
        switch (data.event) {
          case "message":
          case "agent_message":
          case "text_chunk":
            if (data.answer) {
              fullContent += data.answer;
              yield {
                role: "assistant",
                content: data.answer,
              };
            }
            break;

          case "message_end":
            // 流结束，可以记录元数据
            if (data.metadata?.usage) {
              // 记录使用情况（如果需要）
              // console.log("Dify usage:", data.metadata.usage);
            }
            break;

          case "error":
            throw new Error(`Dify stream error: ${JSON.stringify(data)}`);
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
   * 流式文本补全
   * Dify 主要使用 Chat API，这里复用 _streamChat
   */
  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    // 将 prompt 转换为消息格式
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: prompt,
      },
    ];

    // 复用 _streamChat
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
