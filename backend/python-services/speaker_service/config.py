"""
配置文件
"""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    # 服务配置
    HOST: str = "0.0.0.0"
    PORT: int = 5002
    WORKERS: int = 1
    DEBUG: bool = False

    # 模型配置
    MODEL_DIR: str = str(Path(__file__).parent.parent / "models")
    SPEAKER_MODEL: str = "damo/speech_eres2net_base_200k_sv_zh-cn_16k-common"
    DEVICE: str = "cpu"  # cpu 或 cuda

    # 声纹存储
    VOICEPRINT_DIR: str = str(Path(__file__).parent.parent / "voiceprints")

    # 音频处理
    SAMPLE_RATE: int = 16000
    AUDIO_FORMAT: str = "wav"
    MIN_AUDIO_LENGTH: float = 0.5  # 最小音频长度（秒）
    MAX_AUDIO_LENGTH: float = 30.0  # 最大音频长度（秒）

    # 声纹识别参数
    SIMILARITY_THRESHOLD: float = 0.75  # 相似度阈值
    TOP_K_MATCHES: int = 5  # 返回前K个匹配结果

    # 说话人分割参数
    DIARIZATION_MIN_SPEAKERS: int = 1
    DIARIZATION_MAX_SPEAKERS: int = 10

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[str] = None

    # CORS 配置
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:5001"]

    class Config:
        env_prefix = "SPEAKER_"
        case_sensitive = True
        env_file = ".env"


# 全局配置实例
settings = Settings()


def get_settings() -> Settings:
    """获取配置实例"""
    return settings
