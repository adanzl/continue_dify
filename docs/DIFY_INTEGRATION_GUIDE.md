# Dify API 适配指南

## 📋 概述

本指南将帮助你修改 Continue VSCode 插件，使其能够调用 Dify 的 API 接口，实现类似 Cursor 的编程助手功能。

## 🏗️ 架构说明

Continue 插件的核心架构：

```
VSCode Extension (extensions/vscode)
    ↓
Core (core/)
    ↓
LLM Providers (core/llm/llms/)
    ↓
API 调用
```

## 🎯 实现方案

### 方案一：快速配置（推荐用于测试）

如果 Dify 提供了 OpenAI 兼容接口，可以直接修改配置文件：

**配置文件位置：** `~/.continue/config.json` 或 `~/.continue/config.yaml`

```json
{
  "models": [
    {
      "title": "Dify Chat",
      "provider": "openai",
      "model": "your-model-name",
      "apiKey": "app-xxxxxxxxxxxxx",
      "apiBase": "https://api.dify.ai/v1",
      "contextLength": 8000,
      "completionOptions": {
        "temperature": 0.7,
        "maxTokens": 2048
      }
    }
  ],
  "selectedModelByRole": {
    "chat": "Dify Chat",
    "edit": "Dify Chat",
    "autocomplete": "Dify Chat"
  }
}
```

### 方案二：创建自定义 Dify Provider（推荐用于生产）

创建专用的 Dify LLM Provider，支持 Dify 特有功能（工作流、知识库等）。

## 🔧 详细实现步骤

### 步骤 1：创建 Dify LLM Provider

创建文件：`core/llm/llms/Dify.ts`

```typescript
import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { BaseLLM } from "../index.js";

class Dify extends BaseLLM {
  static providerName: ModelProvider = "dify";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.dify.ai/v1",
    model: "chat",
    contextLength: 8000,
  };

  private _convertMessage(message: ChatMessage) {
    // Dify API 的消息格式
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: message.content,
      };
    }
    
    // 处理多模态内容
    return {
      role: message.role,
      content: message.content
        .map((part) => {
          if (part.type === "text") {
            return part.text;
          }
          return "";
        })
        .join("\\n"),
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiBase = this.apiBase || Dify.defaultOptions.apiBase;
    const apiKey = this.apiKey;

    if (!apiKey) {
      throw new Error("Dify API key not provided");
    }

    // Dify Chat API 请求体
    const requestBody = {
      inputs: {},
      query: messages[messages.length - 1].content,
      response_mode: "streaming",
      conversation_id: "", // 可以存储对话ID以维持上下文
      user: "continue-vscode",
    };

    const response = await this.fetch(`${apiBase}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    // 处理 Dify SSE 响应
    for await (const chunk of streamSse(response)) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta;
        if (delta?.content) {
          yield {
            role: "assistant",
            content: delta.content,
          };
        }
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    // Dify Completion API
    const apiBase = this.apiBase || Dify.defaultOptions.apiBase;
    const apiKey = this.apiKey;

    if (!apiKey) {
      throw new Error("Dify API key not provided");
    }

    const requestBody = {
      inputs: {},
      response_mode: "streaming",
      user: "continue-vscode",
      files: [],
    };

    const response = await this.fetch(`${apiBase}/completion-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    for await (const chunk of streamSse(response)) {
      if (chunk.answer) {
        yield chunk.answer;
      }
    }
  }
}

export default Dify;
```

### 步骤 2：注册 Provider

修改文件：`core/llm/llms/index.ts`

```typescript
// 1. 在文件顶部导入
import Dify from "./Dify";

// 2. 在 LLMClasses 数组中添加
export const LLMClasses = [
  Anthropic,
  // ... 其他 providers
  Dify, // 添加这一行
  // ...
];
```

### 步骤 3：添加 TypeScript 类型定义

修改文件：`core/index.d.ts` (搜索 `ModelProvider` 类型)

```typescript
export type ModelProvider =
  | "openai"
  | "anthropic"
  // ... 其他 providers
  | "dify" // 添加这一行
  // ...
  ;
```

### 步骤 4：编译和测试

```bash
# 在项目根目录
cd /Users/zhaolin/Documents/Projects/continue_dify

# 编译 core
cd core
npm run build

# 编译 vscode 扩展
cd ../extensions/vscode
npx tsc -p ./
```

### 步骤 5：配置使用

修改 `~/.continue/config.json`：

```json
{
  "models": [
    {
      "title": "Dify Assistant",
      "provider": "dify",
      "model": "chat",
      "apiKey": "app-xxxxxxxxxxxxx",
      "apiBase": "https://api.dify.ai/v1",
      "contextLength": 8000,
      "completionOptions": {
        "temperature": 0.7,
        "maxTokens": 2048
      }
    }
  ],
  "selectedModelByRole": {
    "chat": "Dify Assistant",
    "edit": "Dify Assistant"
  }
}
```

## 📝 Dify API 参考

### Chat API

**端点：** `POST /v1/chat-messages`

**请求头：**
```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**请求体：**
```json
{
  "inputs": {},
  "query": "用户的问题",
  "response_mode": "streaming",
  "conversation_id": "",
  "user": "continue-vscode"
}
```

**响应（SSE 流）：**
```
data: {"event": "message", "answer": "AI 的回复"}
data: {"event": "message_end", "metadata": {...}}
```

### Workflow API（进阶）

如果要使用 Dify 工作流：

**端点：** `POST /v1/workflows/run`

```json
{
  "inputs": {
    "code": "当前代码",
    "question": "用户问题"
  },
  "response_mode": "streaming",
  "user": "continue-vscode"
}
```

## 🧪 测试步骤

### 1. 基础测试

在 VSCode 中：
1. 按 F5 启动调试
2. 在新窗口中打开 Continue 面板
3. 输入测试消息
4. 观察终端日志

### 2. 调试日志

在 `Dify.ts` 中添加调试：

```typescript
console.log("Dify Request:", requestBody);
console.log("Dify Response:", chunk);
```

### 3. 网络调试

使用 VSCode 内置的网络监控或添加：

```typescript
this.logger?.log("Dify API Call", {
  endpoint: `${apiBase}/chat-messages`,
  apiKey: apiKey.substring(0, 10) + "...",
});
```

## 🚀 进阶功能

### 1. 支持 Dify 知识库

```typescript
interface DifyRequestWithKnowledge {
  inputs: {};
  query: string;
  response_mode: "streaming";
  conversation_id: string;
  user: string;
  // 添加知识库检索
  retrieval_model: {
    search_method: "keyword_search" | "semantic_search";
    reranking_enable: boolean;
    reranking_mode: "reranking_model";
    top_k: number;
    score_threshold: number;
  };
}
```

### 2. 支持工具调用（Function Calling）

```typescript
// 在 Dify.ts 中添加
async *_streamChatWithTools(
  messages: ChatMessage[],
  tools: any[],
  signal: AbortSignal,
) {
  // 实现工具调用逻辑
}
```

### 3. 会话管理

```typescript
class DifySessionManager {
  private sessions: Map<string, string> = new Map();

  getConversationId(fileUri: string): string {
    return this.sessions.get(fileUri) || "";
  }

  setConversationId(fileUri: string, conversationId: string) {
    this.sessions.set(fileUri, conversationId);
  }
}
```

## ⚠️ 常见问题

### 1. API Key 错误

**问题：** `401 Unauthorized`

**解决：**
- 检查 API Key 是否正确
- 确认使用的是应用 API Key (以 `app-` 开头)

### 2. CORS 错误

**问题：** 浏览器 CORS 错误

**解决：**
- Continue 在 Node.js 环境运行，不受 CORS 限制
- 如果有问题，检查 `apiBase` 配置

### 3. 流式响应中断

**问题：** SSE 流突然中断

**解决：**
```typescript
try {
  for await (const chunk of streamSse(response)) {
    // 处理
  }
} catch (error) {
  console.error("Stream error:", error);
  // 重试逻辑
}
```

### 4. 中文乱码

**解决：**
```typescript
headers: {
  "Content-Type": "application/json; charset=utf-8",
}
```

## 📚 相关文件

- **LLM Provider 实现：** `core/llm/llms/Dify.ts`
- **LLM 基类：** `core/llm/index.ts`
- **类型定义：** `core/index.d.ts`
- **配置文件：** `~/.continue/config.json`
- **VSCode 扩展入口：** `extensions/vscode/src/extension/VsCodeExtension.ts`

## 🎓 学习资源

1. **Continue 源码学习路径：**
   - `core/llm/llms/OpenAI.ts` - OpenAI 实现
   - `core/llm/llms/Ollama.ts` - 本地模型实现
   - `core/llm/index.ts` - LLM 基类

2. **Dify API 文档：**
   - https://docs.dify.ai/guides/application-publishing/developing-with-apis

3. **Continue 开发文档：**
   - https://continue.dev/docs

## ✅ 下一步

1. ✅ 创建 `Dify.ts` 文件
2. ✅ 注册 Provider
3. ✅ 编译项目
4. ✅ 配置 API Key
5. ✅ 测试基本对话
6. ⏭️ 添加进阶功能（知识库、工具调用）
7. ⏭️ 优化性能和错误处理

## 💡 快速开始命令

```bash
# 1. 创建 Dify Provider
cat > core/llm/llms/Dify.ts << 'EOF'
# [粘贴上面的 Dify.ts 代码]
EOF

# 2. 编译
cd core && npm run build
cd ../extensions/vscode && npx tsc -p ./

# 3. 启动调试
# 打开 VSCode，按 F5
```

---

需要我帮你创建具体的代码文件吗？🚀
