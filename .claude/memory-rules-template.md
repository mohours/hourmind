# 记忆系统迁移模板

将此文件复制到新项目根目录，然后对 Claude 说：**"按照 memory-rules-template.md 设置记忆系统"**。

## 你需要执行的操作

### 1. 创建目录结构

```bash
mkdir -p .claude/memory/conversations/
```

### 2. 创建 .claude/MEMORY.md

将 `<项目名>` 替换为实际项目名：

```markdown
# <项目名> 项目记忆

- [对话日志](memory/conversations/) — 按月归档，每日一个文件
```

### 3. 检查 CLAUDE.md 是否已存在

- **如果已有 CLAUDE.md**：在末尾追加以下内容（不要覆盖原有内容）
- **如果没有 CLAUDE.md**：创建新文件，写入以下内容

追加/写入的内容：

```markdown
## 会话记忆规则

1. **启动时**：检查 transcript 目录下最新 transcript 文件的修改时间，对比 `memory/conversations/` 最新日志的日期。如果 transcript 有未被归档的会话（用户未说下线信号就直接关闭），自动读取 transcript 补录到对话日志，无需用户确认。transcript 位于 `~/.claude/projects/` 下与当前项目对应的目录中，用 `ls -lt` 按修改时间排序取最新。
2. **结束时**：用户表达退出意图（"下班了"、"再见"、"结束"），主动整理本次会话对话日志，并将关键决策、偏好、新上下文写入 `.claude/memory/`。

## 对话日志格式

- 路径：`memory/conversations/YYYY-MM/YYYY-MM-DD.md`（按月归类）
- 按天一个文件，同一天多次会话用 `### 第 N 次会话 (HH:MM-HH:MM)` 分隔追加
- 交错格式：用户消息原文 → Claude 回复 ≤100 字原文照录，>100 字压缩为 ≤100 字摘要，保持问答对应关系
- MEMORY.md 只保留一个指向 `memory/conversations/` 的固定入口，不逐条索引
```

### 4. 创建 .claude/memory/memory-format.md

创建以下文件，并追加到 MEMORY.md 索引。

```markdown
---
name: Memory 格式规范
description: 所有 memory 文件的 frontmatter 必须包含 created_at 和 updated_at 时间戳
type: feedback
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

所有写入 `.claude/memory/` 的文件，frontmatter 中必须包含 `created_at` 和 `updated_at` 字段，格式为 `YYYY-MM-DD HH:MM`。

**Why:** 方便追踪每条记忆的记录时效。

**How to apply:** 创建新 memory 文件时写入当前时间。更新已有 memory 时同步更新 `updated_at`。
```

### 5. 创建 .claude/memory/user-preferences.md

创建以下占位文件，并追加到 MEMORY.md 索引。之后每次会话结束时，根据对话中新发现的用户偏好更新此文件。

```markdown
---
name: 用户偏好记录
description: 通过对话发现的用户编码风格、思维模式、沟通偏好
type: user
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

## 代码风格
<!-- 从对话中观察，逐条记录 -->

## 沟通偏好
<!-- 从对话中观察，逐条记录 -->

## 交付习惯
<!-- 从对话中观察，逐条记录 -->
```

### 6. 创建 .claude/memory/business-index.md

通过阅读项目代码（目录结构、路由、handler/controller、数据库 schema）理解业务模块划分，创建业务功能索引，并追加到 MEMORY.md 索引。如果项目有设计文档，作为补充参考——但以代码为准。

- **若项目已有代码**（中途加入记忆系统）：从代码反推各模块的业务功能描述和代码路径，顶部加注 `<!-- 加入记忆系统前的历史变更不可追溯 -->`
- **若项目尚无代码**（新项目）：从设计文档提取模块列表，创建占位文件，状态标记为"未实现"，待有代码后再填充

之后每实现一个模块或发生业务变更，同步更新此文件的代码路径和变更记录。

初始文件内容：

```markdown
---
name: 业务功能索引
description: 记录项目业务功能的出生到死亡——功能描述、设计文档、代码位置、变更历史
type: project
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

<!-- 按模块逐一列出，格式如下 -->
## <模块名>

- **功能**：<一句话描述>
- **状态**：未实现 / 已实现 / 已废弃
- **设计文档**：<PRD 或计划文件路径>
- **代码**：// 待实现
- **变更记录**：
```

### 7. 验证

逐一检查以下项目，确保无遗漏：

1. `.claude/MEMORY.md` — 索引包含所有已创建的记忆文件入口（conversations/、memory-format.md、user-preferences.md、business-index.md）
2. `CLAUDE.md` — 记忆规则段落已就位
3. `memory/conversations/` — 目录已创建
4. 全部 4 个 memory 文件已创建（memory-format、user-preferences、business-index，以及 conversations 目录）

设置完成后告知用户：记忆系统已就绪，用户说"下班了"等信号时 Claude 会自动整理对话日志，直接关闭也不会丢失记录。

## 设计说明（给用户看，不用执行）

这套记忆系统的核心思路：
- **对话日志**：按天存储，用户全文 + Claude 回复（≤100 字照录，>100 字压缩摘要）交错排列
- **自动补录**：即使忘记说"下班了"，下次启动也会自动从 transcript 补录
- **索引精简**：MEMORY.md 不逐条列日志，避免随时间膨胀
- **不依赖 hook**：纯 Claude Code 内置能力，无需外部插件或 MCP
