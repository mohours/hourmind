# server/services/crypto_service.py
# AES-256-GCM 加密解密服务 —— API Key 安全存储核心
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from config import ENCRYPTION_KEY


def _get_key() -> bytes:
    """将 ENCRYPTION_KEY 用 SHA-256 派生为 32 字节 AES 密钥"""
    return hashlib.sha256(ENCRYPTION_KEY.encode()).digest()


def encrypt(plaintext: str) -> str:
    """
    用 AES-256-GCM 加密明文
    返回格式: "nonce_hex:auth_tag_hex:ciphertext_hex"
    GCM 模式自动生成 auth_tag（16 字节）
    """
    key = _get_key()
    nonce = os.urandom(12)  # GCM 推荐 12 字节 nonce
    aesgcm = AESGCM(key)
    # AESGCM.encrypt 返回 ciphertext + 16 字节 auth_tag（已拼接在末尾）
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext.encode(), None)
    # 分离 ciphertext 和 auth_tag（最后 16 字节是 tag）
    ciphertext = ciphertext_with_tag[:-16]
    auth_tag = ciphertext_with_tag[-16:]
    return f"{nonce.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"


def decrypt(encrypted: str) -> str:
    """
    解密 "nonce_hex:auth_tag_hex:ciphertext_hex" 格式的密文
    返回明文
    """
    key = _get_key()
    nonce_hex, auth_tag_hex, ciphertext_hex = encrypted.split(":")
    nonce = bytes.fromhex(nonce_hex)
    auth_tag = bytes.fromhex(auth_tag_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)
    aesgcm = AESGCM(key)
    # 重新拼接 ciphertext + auth_tag
    plaintext = aesgcm.decrypt(nonce, ciphertext + auth_tag, None)
    return plaintext.decode()
