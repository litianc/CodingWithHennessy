"""
FunASR 服务配置
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """服务配置"""

    # 服务配置
    SERVICE_NAME: str = "FunASR Service"
    SERVICE_VERSION: str = "1.0.0"
    HOST: str = "0.0.0.0"
    PORT: int = 5003

    # 模型配置
    ASR_MODEL: str = "damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    DEVICE: str = "cpu"  # 可选: "cpu", "cuda"

    # 音频配置
    SAMPLE_RATE: int = 16000  # 16kHz
    MIN_AUDIO_LENGTH: float = 0.5  # 最短音频长度（秒）
    MAX_AUDIO_LENGTH: float = 600.0  # 最长音频长度（秒，10分钟）

    # 文件存储配置
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "../../logs"

    class Config:
        env_file = ".env"
        case_sensitive = True


# 全局配置实例
settings = Settings()

# 确保目录存在
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.LOG_DIR).mkdir(parents=True, exist_ok=True)
