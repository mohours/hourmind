---
name: Memory 格式规范
description: 所有 memory 文件的 frontmatter 必须包含 created_at 和 updated_at 时间戳
type: feedback
created_at: 2026-06-01 18:55
updated_at: 2026-06-01 18:55
---

所有写入 `.claude/memory/` 的文件，frontmatter 中必须包含 `created_at` 和 `updated_at` 字段，格式为 `YYYY-MM-DD HH:MM`。

**Why:** 用户希望知道每条记忆是什么时候记录的，方便追踪信息时效性。

**How to apply:** 每次创建新的 memory 文件时，在 frontmatter 中写入当前时间。更新已有 memory 时，同步更新 `updated_at`。
