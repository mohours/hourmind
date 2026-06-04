# server/main.py
# FastAPI 应用入口 —— 启动 HTTP 服务（端口 8000），CORS 中间件，数据库自动初始化
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import PORT
from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期 —— 启动时自动初始化数据库（建表 + 种子数据）"""
    init_db()
    yield


# 创建 FastAPI 应用实例
app = FastAPI(title="HourMind API", version="1.0.0", lifespan=lifespan)

# CORS 中间件 —— 允许前端开发服务器（port 5173）跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册认证路由
from routes.auth import router as auth_router
app.include_router(auth_router)

# 注册 API Key 管理路由
from routes.keys import router as keys_router
app.include_router(keys_router)

# 注册仪表盘路由
from routes.dashboard import router as dashboard_router
app.include_router(dashboard_router)

# 注册任务管理路由
from routes.tasks import router as tasks_router
app.include_router(tasks_router)

# 注册知识库路由
from routes.knowledge import router as knowledge_router
app.include_router(knowledge_router)

# 注册系统设置路由
from routes.settings import router as settings_router
app.include_router(settings_router)

# 注册对话会话管理路由
from routes.conversations import router as conv_router
app.include_router(conv_router)

# 注册聊天 WebSocket 路由
from routes.chat_ws import router as chat_ws_router
app.include_router(chat_ws_router)


@app.get("/api/health")
def health():
    """健康检查接口 —— 返回服务状态"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
