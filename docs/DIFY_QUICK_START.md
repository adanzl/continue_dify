# Dify Provider 快速开始指南

## ✅ 已完成的工作

1. ✅ 创建了 `core/llm/llms/Dify.ts` - Dify LLM Provider
2. ✅ 注册到 `core/llm/llms/index.ts`
3. ✅ 添加类型定义到 `packages/config-types/src/index.ts`
4. ✅ 编译成功（core 和 vscode 扩展）

## 🚀 如何使用

### 步骤 1：获取 Dify API Key

1. 登录 Dify 平台：https://cloud.dify.ai
2. 创建或选择一个应用
3. 在应用设置中找到 **API 密钥**
4. 复制 API Key（格式：`app-xxxxxxxxxxxxx`）

### 步骤 2：配置 Continue

有两种配置方式：

#### 方式 A：通过 VSCode 界面配置

1. 在 VSCode 中按 F5 启动调试
2. 在新窗口中，点击左侧的 Continue 图标
3. 点击右上角的设置图标 ⚙️
4. 选择 "Edit config.json"
5. 添加 Dify 配置（见下方示例）

#### 方式 B：直接编辑配置文件

配置文件位置：
- macOS/Linux: `~/.continue/config.json`
- Windows: `%USERPROFILE%\.continue\config.json`

### 步骤 3：配置示例

#### 基础配置（Chat API）

```json
{
  "models": [
    {
      "title": "Dify Chat",
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
    "chat": "Dify Chat",
    "edit": "Dify Chat"
  }
}
```

#### 高级配置（支持 Workflow）

```json
{
  "models": [
    {
      "title": "Dify Chat",
      "provider": "dify",
      "model": "chat",
      "apiKey": "app-chat-key-here",
      "apiBase": "https://api.dify.ai/v1",
      "contextLength": 8000
    },
    {
      "title": "Dify Code Workflow",
      "provider": "dify",
      "model": "workflow",
      "apiKey": "app-workflow-key-here",
      "apiBase": "https://api.dify.ai/v1",
      "contextLength": 8000
    }
  ],
  "selectedModelByRole": {
    "chat": "Dify Chat",
    "edit": "Dify Code Workflow"
  },
  "systemMessage": "你是一个专业的编程助手。"
}
```

#### 私有部署配置

如果你使用的是私有部署的 Dify：

```json
{
  "models": [
    {
      "title": "Dify Private",
      "provider": "dify",
      "model": "chat",
      "apiKey": "app-xxxxxxxxxxxxx",
      "apiBase": "https://your-dify-domain.com/v1",
      "contextLength": 8000
    }
  ]
}
```

### 步骤 4：测试

1. 在 VSCode 中按 F5 启动调试
2. 在新窗口中打开 Continue 面板
3. 输入测试消息，例如：
   ```
   帮我写一个 Python 函数，计算斐波那契数列
   ```
4. 观察 AI 的回复

### 步骤 5：调试（可选）

如果遇到问题，查看调试日志：

1. 在调试窗口中，打开 **调试控制台**（Debug Console）
2. 查看网络请求和响应
3. 检查是否有错误信息

## 📋 配置参数说明

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `title` | ✅ | 模型显示名称 | `"Dify Chat"` |
| `provider` | ✅ | 固定为 `"dify"` | `"dify"` |
| `model` | ✅ | `"chat"` 或 `"workflow"` | `"chat"` |
| `apiKey` | ✅ | Dify 应用 API Key | `"app-xxx"` |
| `apiBase` | ❌ | API 端点（默认官方） | `"https://api.dify.ai/v1"` |
| `contextLength` | ❌ | 上下文长度（默认 8000） | `8000` |
| `completionOptions.temperature` | ❌ | 温度参数（0-1） | `0.7` |
| `completionOptions.maxTokens` | ❌ | 最大输出 tokens | `2048` |

## 🎯 使用场景

### 1. 代码对话助手

**角色：** `chat`  
**模型：** `chat`

```json
{
  "selectedModelByRole": {
    "chat": "Dify Chat"
  }
}
```

**用途：**
- 代码解释
- 技术问答
- 代码审查
- 架构讨论

### 2. 代码编辑助手

**角色：** `edit`  
**模型：** `chat` 或 `workflow`

```json
{
  "selectedModelByRole": {
    "edit": "Dify Chat"
  }
}
```

**用途：**
- 代码重构
- Bug 修复
- 代码优化
- 添加注释

### 3. 自动补全（实验性）

**角色：** `autocomplete`  
**模型：** `chat`

```json
{
  "tabAutocompleteModel": {
    "title": "Dify Autocomplete",
    "provider": "dify",
    "model": "chat",
    "apiKey": "app-xxx"
  }
}
```

**注意：** Dify 的自动补全功能可能不如专门的代码补全模型。

## 🔧 高级功能

### 1. 使用 Workflow

Dify 的 Workflow 可以实现复杂的代码处理流程：

```json
{
  "title": "Code Review Workflow",
  "provider": "dify",
  "model": "workflow",
  "apiKey": "app-workflow-key"
}
```

**Workflow 输入变量：**
- `query`: 用户的问题
- `history`: 历史对话（JSON 字符串）
- `system_message`: 系统消息

### 2. 会话管理

Dify Provider 自动管理会话 ID，保持对话上下文。

**手动重置会话：**
```typescript
// 在代码中（如果需要扩展）
difyProvider.resetConversation();
```

### 3. 多模型切换

可以配置多个 Dify 应用，用于不同场景：

```json
{
  "models": [
    {
      "title": "Dify General",
      "provider": "dify",
      "model": "chat",
      "apiKey": "app-general-key"
    },
    {
      "title": "Dify Code Expert",
      "provider": "dify",
      "model": "chat",
      "apiKey": "app-expert-key"
    }
  ]
}
```

## ⚠️ 常见问题

### 1. 401 Unauthorized

**原因：** API Key 错误或过期

**解决：**
- 检查 API Key 是否正确
- 确认 API Key 以 `app-` 开头
- 在 Dify 平台重新生成 API Key

### 2. 网络连接失败

**原因：** 无法访问 Dify API

**解决：**
- 检查网络连接
- 如果使用代理，配置代理设置
- 私有部署检查 `apiBase` 地址

### 3. 响应缓慢

**原因：** Dify 服务器响应慢或模型处理时间长

**解决：**
- 减少 `maxTokens` 参数
- 使用更快的模型
- 优化 Dify Workflow

### 4. 中文乱码

**原因：** 编码问题

**解决：**
- 确保 VSCode 使用 UTF-8 编码
- 检查 Dify 应用的语言设置

## 📚 相关文档

- [Dify 官方文档](https://docs.dify.ai)
- [Dify API 文档](https://docs.dify.ai/guides/application-publishing/developing-with-apis)
- [Continue 开发文档](https://continue.dev/docs)
- [完整集成指南](./DIFY_INTEGRATION_GUIDE.md)

## 🎉 开始使用

现在你可以：

1. 配置 Dify API Key
2. 启动 VSCode 调试（F5）
3. 开始使用 Dify 驱动的编程助手！

---

**提示：** 完整的配置示例文件位于 `docs/dify-config-example.json`
