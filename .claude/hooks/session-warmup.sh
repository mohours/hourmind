#!/usr/bin/env bash
# 启动预热：加载上次会话最后 10 条对话记录

TRANSCRIPT_DIR="/Users/hours/.claude/projects/-Users-hours-hourmind"

# 取第二新的 transcript（最新的是当前会话）
PREV=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -2 | tail -1)

if [ -z "$PREV" ]; then
  exit 0
fi

# 从尾部取 30 行，提取最多 10 条 user/assistant 消息
CONTENT=$(
  tail -n 30 "$PREV" | python3 -c "
import json, sys

lines = sys.stdin.readlines()
msgs = []
for line in reversed(lines):
    try:
        d = json.loads(line)
    except:
        continue
    msg = d.get('message', {})
    role = msg.get('role', '') if isinstance(msg, dict) else ''
    content = msg.get('content', '') if isinstance(msg, dict) else ''
    if isinstance(content, list):
        texts = [c.get('text', '') for c in content if c.get('type') == 'text']
        content = ' '.join(texts)
    if role in ('user', 'assistant') and content.strip():
        msgs.insert(0, json.dumps({'role': role, 'content': content[:500]}, ensure_ascii=False))
        if len(msgs) >= 10:
            break

print(json.dumps(msgs, ensure_ascii=False))
"
)

if [ -z "$CONTENT" ] || [ "$CONTENT" = "[]" ]; then
  exit 0
fi

# 输出 hook JSON
python3 -c "
import json, sys
content = sys.argv[1]
output = {
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': '=== 上次会话上下文（自动预热）===\n' + content + '\n=== 预热结束 ==='
    }
}
print(json.dumps(output, ensure_ascii=False))
" "$CONTENT"

exit 0
