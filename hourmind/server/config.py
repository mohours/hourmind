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
