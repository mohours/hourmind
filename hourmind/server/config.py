# server/config.py
# 从 .env 加载配置，供其他模块引用
import os
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

# JWT 签名密钥
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
# AES-256-GCM 加密密钥（32 字符）
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "dev-key-32-chars!!!")
# SQLite 数据库文件路径（解析为绝对路径，防止 CWD 变化导致路径错误）
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             os.getenv("DATABASE_PATH", "data/hourmind.db"))
# 服务端口
PORT = int(os.getenv("PORT", "8000"))

# ── OAuth 第三方登录配置 ──
# GitHub OAuth（localhost 回调）
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/auth/oauth/github/callback")
# 微信开放平台（预留，需公网域名 + 备案）
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID", "")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET", "")
