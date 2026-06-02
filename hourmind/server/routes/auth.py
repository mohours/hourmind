# server/routes/auth.py
# 认证路由 —— 密码设置、登录、Token 验证
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import create_token, verify_token, require_auth
from models import AuthRequest, AuthResponse, CheckResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/setup", response_model=AuthResponse)
def setup(body: AuthRequest):
    """首次设置密码 —— 仅在 config 表中无 password_hash 时可用"""
    db = get_db()
    try:
        existing = db.execute(
            "SELECT value FROM config WHERE key = ?", ("password_hash",)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="密码已设置，请使用登录接口")

        # bcrypt 哈希密码（cost=12）
        hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12))
        hashed_str = hashed.decode()

        # 存入 config 表
        db.execute(
            "INSERT INTO config (key, value) VALUES (?, ?)",
            ("password_hash", hashed_str),
        )
        db.commit()

        # 签发 Token
        token = create_token()
        return AuthResponse(token=token)
    finally:
        db.close()


@router.post("/login", response_model=AuthResponse)
def login(body: AuthRequest):
    """密码登录 —— 验证密码后返回 JWT"""
    db = get_db()
    try:
        row = db.execute(
            "SELECT value FROM config WHERE key = ?", ("password_hash",)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="尚未设置密码，请先完成初始化")

        hashed = row["value"]
        # bcrypt 验证密码
        if not bcrypt.checkpw(body.password.encode(), hashed.encode()):
            raise HTTPException(status_code=401, detail="密码错误")

        token = create_token()
        return AuthResponse(token=token)
    finally:
        db.close()


@router.get("/check", response_model=CheckResponse)
def check(payload: dict = Depends(require_auth)):
    """验证当前 Token 是否有效 —— 并检查是否需要初始化"""
    db = get_db()
    try:
        row = db.execute(
            "SELECT value FROM config WHERE key = ?", ("password_hash",)
        ).fetchone()
        setup_required = row is None
        return CheckResponse(valid=True, setup_required=setup_required)
    finally:
        db.close()


@router.get("/status")
def status():
    """无需认证的状态检查 —— 返回是否已设置密码"""
    db = get_db()
    try:
        row = db.execute(
            "SELECT value FROM config WHERE key = ?", ("password_hash",)
        ).fetchone()
        return {"setup_required": row is None}
    finally:
        db.close()
