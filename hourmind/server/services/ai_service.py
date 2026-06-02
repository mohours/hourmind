# server/services/ai_service.py
# 流式 AI 提供商 API 调用器 —— SSE 解析、消息历史管理、对话持久化
import json  # JSON 序列化/反序列化
import httpx  # 异步 HTTP 客户端（支持 SSE 流）
from database import get_db  # 数据库连接获取
from services.crypto_service import decrypt  # AES-256-GCM 解密


async def stream_chat(conversation_id, model, content, cancel_flag=None):
    """
    流式聊天 —— 调厂商 /chat/completions（SSE），逐块 yield 响应
    参数:
        conversation_id: 对话会话 ID（对应 conversation 表主键）
        model: 模型标识符（如 gpt-4o、claude-sonnet-4-20250514）
        content: 用户最新输入文本
        cancel_flag: 可选的取消标志字典 {"cancelled": bool}，用于中断流
    Yields:
        {"type":"chunk","content":"..."}  —— 增量文本块
        {"type":"end","token_count":N,"model":"..."}  —— 流正常结束
        {"type":"error","message":"..."}  —— 异常或取消
    """
    db = get_db()  # 获取数据库连接
    try:
        # ── 1. 查找可用的活跃 API Key（联表查 provider 获取 base_url）──
        key_row = db.execute("""
            SELECT ak.encrypted_key, p.base_url, p.slug
            FROM api_key ak
            INNER JOIN provider p ON p.id = ak.provider_id
            WHERE ak.status = 'active'
            ORDER BY ak.updated_at DESC
            LIMIT 1
        """).fetchone()  # 取最近更新的活跃 Key

        if not key_row:  # 没有可用 Key
            yield {"type": "error", "message": "没有可用的 API Key，请先在 Key 管理中添加并激活"}
            return

        # ── 2. 解密 API Key ──
        try:
            plain_key = decrypt(key_row["encrypted_key"])  # AES-256-GCM 解密
        except Exception as e:  # 解密失败
            yield {"type": "error", "message": f"API Key 解密失败: {str(e)}"}
            return

        base_url = key_row["base_url"].rstrip("/")  # 去掉末尾斜杠，拼 URL 用

        # ── 3. 加载对话历史 ──
        conv = db.execute(
            "SELECT messages_json FROM conversation WHERE id = ?",
            (conversation_id,)
        ).fetchone()  # 查当前会话记录

        if conv and conv["messages_json"]:  # 已有历史消息
            messages = json.loads(conv["messages_json"])  # 反序列化消息列表
        else:  # 新会话
            messages = []

        messages.append({"role": "user", "content": content})  # 追加用户新消息

        # ── 4. 构造请求体 ──
        url = f"{base_url}/chat/completions"  # OpenAI 兼容端点
        payload = {
            "model": model,  # 模型标识
            "messages": messages,  # 完整消息历史
            "stream": True,  # 开启 SSE 流式返回
        }

        # ── 5. 发起异步 SSE POST 请求 ──
        full_response = ""  # 累积完整回复文本
        token_count = 0  # Token 用量计数

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:  # 120s 超时
            async with client.stream(  # 流式请求
                "POST", url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {plain_key}",  # Bearer 认证
                    "Content-Type": "application/json",  # JSON 内容类型
                }
            ) as response:
                if response.status_code != 200:  # HTTP 非 200 即失败
                    # 尝试读取错误响应体
                    try:
                        error_body = await response.aread()  # 读取响应体
                        error_text = error_body.decode()[:500]  # 截取前 500 字符
                    except Exception:  # 读取失败则用状态码
                        error_text = f"HTTP {response.status_code}"
                    yield {"type": "error", "message": f"API 错误 ({response.status_code}): {error_text}"}
                    return

                async for line in response.aiter_lines():  # 逐行读取 SSE 流
                    # ── 检查取消标志 ──
                    if cancel_flag and cancel_flag.get("cancelled"):  # 用户取消
                        # 保存已收到的部分回复
                        _save_response(db, conversation_id, messages, full_response)
                        yield {"type": "error", "message": "用户取消"}
                        return

                    if not line.startswith("data: "):  # 非 SSE 数据行则跳过
                        continue

                    data = line[6:]  # 去掉 "data: " 前缀（6 个字符）
                    if data == "[DONE]":  # SSE 流结束标记
                        break

                    try:
                        obj = json.loads(data)  # 解析 JSON 数据块
                    except json.JSONDecodeError:  # 解析失败跳过
                        continue

                    # ── 提取增量内容 ──
                    choices = obj.get("choices", [])  # 获取 choices 数组
                    if choices:  # choices 非空
                        delta = choices[0].get("delta", {})  # 获取 delta 对象
                        chunk_text = delta.get("content", "")  # 提取增量文本
                        if chunk_text:  # 有文本内容
                            full_response += chunk_text  # 累积完整回复
                            yield {"type": "chunk", "content": chunk_text}  # 推送增量块

                    # ── 尝试从 chunk 中提取 token 用量 ──
                    usage = obj.get("usage", {})  # 部分厂商在最后的 chunk 中包含 usage
                    if usage:  # 有 usage 数据
                        token_count = usage.get("total_tokens", 0)  # 提取总 token 数

        # ── 6. 保存助手回复到数据库 ──
        _save_response(db, conversation_id, messages, full_response)

        # ── 7. 返回结束事件 ──
        yield {
            "type": "end",  # 流结束标志
            "token_count": token_count,  # Token 消耗数
            "model": model,  # 使用的模型
        }

    except httpx.TimeoutException:  # HTTP 请求超时
        yield {"type": "error", "message": "请求超时（120s），请检查网络或稍后重试"}
    except httpx.ConnectError:  # 连接失败
        yield {"type": "error", "message": "无法连接到 API 服务器，请检查 base_url 配置"}
    except Exception as e:  # 其他未预期异常
        yield {"type": "error", "message": str(e)}
    finally:
        db.close()  # 确保关闭数据库连接


def _save_response(db, conversation_id, messages, full_response):
    """
    内部函数 —— 将用户消息和助手回复写入数据库
    参数:
        db: sqlite3 连接
        conversation_id: 会话 ID
        messages: 当前消息列表（已包含用户消息，不含助手回复）
        full_response: 助手完整回复文本
    """
    if not full_response:  # 没有回复内容则不保存
        return

    messages.append({"role": "assistant", "content": full_response})  # 追加助手回复
    db.execute("""
        UPDATE conversation
        SET messages_json = ?,
            message_count = message_count + 2,
            total_tokens = total_tokens + ?,
            updated_at = datetime('now')
        WHERE id = ?
    """, (
        json.dumps(messages, ensure_ascii=False),  # 序列化完整消息列表
        0,  # token_count，此处不精确统计，由 end 事件告知前端
        conversation_id,
    ))
    db.commit()  # 提交事务
