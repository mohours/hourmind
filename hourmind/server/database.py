# server/database.py
# sqlite3 连接管理 —— 提供 get_db() 获取数据库连接，init_db() 首次初始化
import sqlite3
import os
from config import DATABASE_PATH

def get_db() -> sqlite3.Connection:
    """获取数据库连接，每次调用返回新连接"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # 查询结果可以用 row['列名'] 访问
    conn.execute("PRAGMA journal_mode=WAL")  # WAL 模式 —— 写操作不阻塞读
    conn.execute("PRAGMA foreign_keys=ON")   # 开启外键约束
    return conn

def init_db():
    """初始化数据库 —— 执行建表 SQL 和种子数据 SQL"""
    # 确保数据目录存在
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # 读取并执行建表脚本
    schema_path = os.path.join(base_dir, "db", "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # 读取并执行种子数据脚本
    seed_path = os.path.join(base_dir, "db", "seed.sql")
    with open(seed_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    conn.commit()
    conn.close()
