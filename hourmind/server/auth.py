# server/auth.py
# JWT Token 创建/验证 + FastAPI 认证依赖注入
import time
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Header, HTTPException
from config import JWT_SECRET

TOKEN_EXPIRE_HOURS = 24  # Token 有效期 24 小时


def create_token(user_id: str = "default") -> str:
    """创建 JWT Token —— 包含 user_id 和 24h 过期时间"""
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "iat": now,                           # 签发时间
        "exp": now + TOKEN_EXPIRE_HOURS * 3600,  # 过期时间
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict:
    """验证 JWT Token —— 返回 payload，无效/过期则抛出 HTTPException"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效")


def require_auth(authorization: str = Header(None)) -> dict:
    """FastAPI 依赖注入 —— 从 Bearer Header 提取并验证 Token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未认证")
    token = authorization.replace("Bearer ", "")
    return verify_token(token)
