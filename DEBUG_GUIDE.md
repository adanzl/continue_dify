# VSCode插件调试指南

## 🎯 快速开始

### 方法1: 使用VSCode调试（推荐）

1. **用VSCode打开项目根目录**
   ```bash
   code /Users/zhaolin/Documents/Projects/continue_dify
   ```

2. **确保已编译**
   ```bash
   cd extensions/vscode
   npx tsc -p ./
   ```

3. **启动调试**
   - 按 `F5` 或点击菜单 `运行 > 启动调试`
   - 选择 `Launch VSCode Extension (无预编译)`
   - 会打开一个新的VSCode窗口，插件已加载

### 方法2: 自动编译 + 调试

1. **启动监听模式**
   ```bash
   # 终端1: 监听文件变化，自动编译
   cd extensions/vscode
   npx tsc -p ./ --watch
   ```

2. **启动调试**
   - 按 `F5`
   - 选择 `Launch VSCode Extension (精简版)`

---

## 📋 调试配置说明

### 配置1: Launch VSCode Extension (精简版)
- **用途**: 自动编译后启动
- **preLaunchTask**: 会先编译TypeScript
- **适合**: 修改代码后第一次调试

### 配置2: Launch VSCode Extension (无预编译)
- **用途**: 直接使用已编译的代码
- **无preLaunchTask**: 不会重新编译
- **适合**: 代码已编译，快速调试

---

## 🔧 常见问题

### 问题1: 按F5没反应
**原因**: 必须在**项目根目录**打开VSCode，不是`extensions/vscode`目录

**解决**:
```bash
# 关闭当前VSCode窗口
# 重新打开根目录
code /Users/zhaolin/Documents/Projects/continue_dify
```

### 问题2: 提示找不到out/extension.js
**原因**: 没有编译

**解决**:
```bash
cd extensions/vscode
npx tsc -p ./
# 检查是否生成out目录
ls -la out/
```

### 问题3: 编译错误
**原因**: packages未编译

**解决**:
```bash
# 编译所有packages
cd packages
for dir in config-types fetch config-yaml openai-adapters terminal-security llm-info; do
  cd $dir && npm run build && cd ..
done
```

---

## 🎨 调试工作流

### 开发流程
```
1. 修改代码
   ↓
2. 保存文件
   ↓
3. [自动] tsc编译 (如果开启了watch模式)
   ↓
4. 按F5启动调试
   ↓
5. 在新VSCode窗口测试
   ↓
6. 修改代码 → 重复
```

### 监听模式开发
```bash
# 终端1: 自动编译
cd extensions/vscode
npx tsc -p ./ --watch

# 然后随时按F5调试即可
# 修改代码后会自动重新编译
```

---

## 📂 输出目录结构

编译后的目录结构：
```
extensions/vscode/
├── out/              # 编译输出
│   └── tsc/
│       └── src/
│           ├── extension.js        # 入口文件
│           ├── VsCodeIde.js
│           ├── ContinueGUIWebviewViewProvider.js
│           └── ...                 # 其他JS文件
│
├── src/              # 源代码
│   ├── extension.ts
│   └── ...
│
└── package.json
```

---

## 🚀 调试技巧

### 1. 断点调试
- 在`.ts`文件中设置断点
- 按F5启动调试
- 代码执行到断点时会暂停
- 可以查看变量值、调用栈等

### 2. 控制台输出
```typescript
// 在代码中添加
console.log('调试信息', variable);
```
输出会显示在调试控制台

### 3. 查看插件日志
- 新VSCode窗口中: `帮助 > 切换开发人员工具`
- 查看Console面板

### 4. 重新加载插件
- 在新VSCode窗口中按 `Cmd+R` (Mac) 或 `Ctrl+R` (Windows)
- 无需重启整个调试会话

---

## 📝 VSCode任务

可用的VSCode任务（`Cmd+Shift+P` → `Tasks: Run Task`）：

| 任务 | 说明 |
|------|------|
| `compile-vscode-extension` | 编译VSCode扩展 |
| `watch-vscode-extension` | 监听模式编译 |
| `compile-packages` | 编译所有packages |

---

## ⚡ 快捷键

| 操作 | 快捷键 (Mac) | 快捷键 (Windows) |
|------|-------------|----------------|
| 启动调试 | `F5` | `F5` |
| 停止调试 | `Shift+F5` | `Shift+F5` |
| 重新启动 | `Cmd+Shift+F5` | `Ctrl+Shift+F5` |
| 重新加载插件 | `Cmd+R` | `Ctrl+R` |

---

## 📊 检查清单

启动调试前确认：
- ✅ 在项目根目录打开VSCode
- ✅ 存在 `.vscode/launch.json`
- ✅ packages已编译
- ✅ extensions/vscode已编译
- ✅ 存在 `extensions/vscode/out/` 目录

---

## 🔗 相关文件

- `.vscode/launch.json` - 调试配置
- `.vscode/tasks.json` - 构建任务
- `extensions/vscode/tsconfig.json` - TypeScript配置
- `extensions/vscode/package.json` - 插件配置
