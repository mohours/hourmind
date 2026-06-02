---
name: 跨会话记忆偏好
description: 用户希望每次会话关闭前自动总结并存入项目记忆，下次新会话能回顾之前内容
type: feedback
created_at: 2026-06-01 17:15
updated_at: 2026-06-01 17:15
---

用户要求在 HourMind 项目中启用跨会话记忆机制，确保每次重新启动后 Claude 能回顾之前的交流内容。

**Why:** 用户认为每次重新打开都是全新大脑很不方便，希望有连续性。

**How to apply:**
- 用户说"下班了"、"再见"、"结束"等时，主动总结当次会话关键内容写入 `.claude/memory/`
- 对话日志采用交错格式保存到 `memory/conversations/YYYY-MM/YYYY-MM-DD.md`
- 更新 `.claude/MEMORY.md` 索引
- 仅限 HourMind 项目，其他项目不受影响
