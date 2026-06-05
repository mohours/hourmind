# 启动预热 Hook — 设计文档

## 1. 目标

用 SessionStart hook 在会话启动时自动注入上一场会话最后 10 条对话记录，替代 CLAUDE.md 中未强制执行的被动预热规则。

## 2. 约束

- 所有改动只在项目内 `.claude/`，不碰全局配置
- 脚本输出 RAW JSONL，不做格式转换

## 3. 变更清单

| # | 操作 | 文件 | 说明 |
|---|------|------|------|
| 1 | 新建 | `.claude/session-warmup.sh` | hook 脚本，找到上一场 transcript，提取最后 10 条消息，输出 additionalContext |
| 2 | 追加 | `.claude/settings.local.json` | hooks 段注册 SessionStart hook |
| 3 | 删除 | `CLAUDE.md` 第 131 行 | 废弃的"启动预热"被动规则 |

## 4. Hook 脚本逻辑

```
SessionStart "startup" 触发
  → ls -t 列出 transcript 目录，取第二新的文件
  → 没有上一场？→ 输出 {"continue":true} 退出
  → tail -n 30 读取尾部 30 行
  → grep 提取 user/assistant 的 JSONL 消息，最多 10 条
  → 拼装为 hook JSON
  → 注入 additionalContext
```

## 5. Edge Cases

- **首次使用**（无 transcript）：空白退出，不注入
- **只有当前会话**（无第二新文件）：空白退出
- **文件读失败**：hook 超时自动中止，不影响会话启动

## 6. 验证

1. 退出当前会话，新启动一次
2. 问"上次聊了什么"——应能准确回答上一场最后 10 条的内容
3. 检查 token 消耗——additionalContext 预期占用 ~1-3k tokens
