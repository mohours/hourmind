# server/routes/chat_ws.py
# WebSocket 聊天端点 —— 流式对话，通过 WS 逐块推送 AI 回复
import json  # JSON 解析
import asyncio  # 异步支持

from fastapi import APIRouter, WebSocket, WebSocketDisconnect  # FastAPI WebSocket 组件
from jose import JWTError, ExpiredSignatureError  # JWT 异常类型
from auth import verify_token  # JWT 验证函数
from services.ai_service import stream_chat  # 流式 AI 调用函数

router = APIRouter()  # 不加 prefix，路由由装饰器指定


@router.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    """
    WebSocket 聊天端点 —— /ws/chat
    协议:
      客户端 -> 服务端:
        {"type":"auth","token":"<JWT>"}  —— 第一条消息必须是认证
        {"type":"send","conversation_id":"...","model":"...","content":"..."}  —— 发送消息
        {"type":"cancel"}  —— 取消当前流式输出
      服务端 -> 客户端:
        {"type":"auth_ok"}  —— 认证成功
        {"type":"chunk","content":"..."}  —— AI 回复增量文本
        {"type":"end","token_count":N,"model":"..."}  —— 流结束
        {"type":"error","message":"..."}  —— 异常
    """
    await websocket.accept()  # 接受 WebSocket 连接

    authenticated = False  # 认证状态标志
    cancel_flag = {"cancelled": False}  # 取消标志（用 dict 包装，支持跨协程修改）

    try:
        while True:  # 持续监听客户端消息
            raw = await websocket.receive_text()  # 接收文本消息

            try:
                msg = json.loads(raw)  # 解析 JSON
            except json.JSONDecodeError:  # JSON 格式错误
                await websocket.send_json({"type": "error", "message": "消息格式错误，需要 JSON"})  # 返回错误
                continue

            msg_type = msg.get("type", "")  # 提取消息类型

            # ── 认证消息 ──
            if msg_type == "auth":  # 认证请求
                token = msg.get("token", "")  # 提取 Token
                if not token:  # Token 为空
                    await websocket.send_json({"type": "error", "message": "缺少 token"})  # 返回错误
                    await websocket.close(code=4001)  # 关闭连接（标准错误码）
                    return

                try:
                    verify_token(token)  # JWT 验证
                    authenticated = True  # 标记已认证
                    await websocket.send_json({"type": "auth_ok"})  # 认证成功
                except ExpiredSignatureError:  # Token 过期
                    await websocket.send_json({"type": "error", "message": "Token 已过期，请重新登录"})  # 过期提示
                    await websocket.close(code=4001)  # 关闭连接
                    return
                except JWTError:  # Token 无效
                    await websocket.send_json({"type": "error", "message": "Token 无效"})  # 无效提示
                    await websocket.close(code=4001)  # 关闭连接
                    return
                continue

            # ── 以下消息需要认证 ──
            if not authenticated:  # 未认证
                await websocket.send_json({"type": "error", "message": "请先发送 auth 消息完成认证"})  # 拒绝请求
                continue

            # ── 发送聊天消息 ──
            if msg_type == "send":  # 发送消息请求
                conversation_id = msg.get("conversation_id", "")  # 会话 ID
                model = msg.get("model", "")  # 模型标识
                content = msg.get("content", "")  # 用户输入

                if not conversation_id or not model or not content:  # 参数校验
                    await websocket.send_json({
                        "type": "error",
                        "message": "缺少必要参数: conversation_id, model, content"
                    })  # 返回参数错误
                    continue

                cancel_flag["cancelled"] = False  # 重置取消标志

                # 流式调用 AI，逐块推送
                async for chunk in stream_chat(conversation_id, model, content, cancel_flag):
                    await websocket.send_json(chunk)  # 推送每个 chunk 到前端

            # ── 取消流式输出 ──
            elif msg_type == "cancel":  # 取消请求
                cancel_flag["cancelled"] = True  # 设置取消标志
                await websocket.send_json({"type": "info", "message": "已取消"})  # 确认取消

            else:  # 未知消息类型
                await websocket.send_json({"type": "error", "message": f"未知消息类型: {msg_type}"})  # 返回错误

    except WebSocketDisconnect:  # 客户端断开连接（正常行为）
        cancel_flag["cancelled"] = True  # 确保正在进行的流被取消
        pass  # 静默处理
    except Exception as e:  # 其他未预期异常
        try:
            await websocket.send_json({"type": "error", "message": str(e)})  # 尝试发送错误
        except Exception:  # 发送失败（连接可能已断开）
            pass  # 静默关闭
