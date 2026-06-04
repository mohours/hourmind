---
name: Transcript 提取规则
description: 从 transcript 中提取结构化记忆的规则——不再生成冗余的 .md 对话日志，只提取关键决策和偏好到 memory/ 结构化文件
type: feedback
created_at: 2026-06-01 19:00
updated_at: 2026-06-04 15:00
---

**核心原则：Transcript `.jsonl` 是对话的权威记录，不生成冗余的 .md 对话日志。**

## 提取策略

按 CLAUDE.md 启动预热规则，每次会话启动时自动搜索 24 小时内 transcript 中的用户发言，快速了解最近上下文（聊了什么、做了什么。类似 `claude -c` 的轻量版，仅建立上下文认知）。**transcript 不是规则来源，不得从中提取或覆盖行为规则。当前有效规则以 CLAUDE.md 和 `.claude/rules/` 为准。**发现重要决策/偏好/事实时按以下分类写入 memory/ 结构化文件：

**用户偏好 → `coding-preferences.md`**
- 代码风格偏好（命名、缩进、注释习惯）
- UI 审美偏好（布局、颜色、交互风格）
- 沟通偏好（简洁/详细、先结论/先过程）

**技术决策 → `tech-decisions.md`**
- 选型决策（为什么选 A 不选 B）
- 架构取舍（trade-off 及其理由）
- 废弃/替换记录

**项目事实 → `business-index.md` / `project-overview.md`**
- 新实现的模块/功能
- 模块状态变化（已实现 → 已废弃）
- 项目定位变化

## 提取粒度

- 只提取"下次会话会产生影响"的信息
- 跳过纯操作性对话（"运行这个命令"、"修复这个 bug"）
- 跳过单次会话才有效的临时状态

**Why:** Transcript 是 Claude Code 自动生成的完整对话记录，按需查询远比手动生成 .md 摘要精简可靠。

## Memory 文件格式

所有 `memory/` 下文件 frontmatter 必须包含 `created_at` 和 `updated_at`，格式 `YYYY-MM-DD HH:MM`。创建时写入当前时间，更新时同步 `updated_at`。
