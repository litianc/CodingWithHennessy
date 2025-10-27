"""
工具函数
"""
import os
import hashlib
import librosa
import numpy as np
import soundfile as sf
from pathlib import Path
from typing import Tuple, Optional
from loguru import logger

from .config import settings


def ensure_dir(directory: str) -> None:
    """确保目录存在"""
    Path(directory).mkdir(parents=True, exist_ok=True)


def generate_speaker_id(name: str, timestamp: Optional[str] = None) -> str:
    """生成声纹ID"""
    import time
    ts = timestamp or str(int(time.time() * 1000))
    content = f"{name}_{ts}"
    return hashlib.md5(content.encode()).hexdigest()


def load_audio(
    audio_path: str,
    target_sr: int = 16000,
    mono: bool = True
) -> Tuple[np.ndarray, int]:
    """
    加载音频文件

    Args:
        audio_path: 音频文件路径
        target_sr: 目标采样率
        mono: 是否转换为单声道

    Returns:
        (audio_data, sample_rate): 音频数据和采样率
    """
    try:
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=mono)
        logger.info(f"加载音频: {audio_path}, shape={audio.shape}, sr={sr}")
        return audio, sr
    except Exception as e:
        logger.error(f"加载音频失败: {audio_path}, error={e}")
        raise ValueError(f"无法加载音频文件: {str(e)}")


def save_audio(
    audio_data: np.ndarray,
    output_path: str,
    sample_rate: int = 16000
) -> None:
    """
    保存音频文件

    Args:
        audio_data: 音频数据
        output_path: 输出路径
        sample_rate: 采样率
    """
    try:
        ensure_dir(os.path.dirname(output_path))
        sf.write(output_path, audio_data, sample_rate)
        logger.info(f"保存音频: {output_path}")
    except Exception as e:
        logger.error(f"保存音频失败: {output_path}, error={e}")
        raise ValueError(f"无法保存音频文件: {str(e)}")


def validate_audio_length(
    audio: np.ndarray,
    sample_rate: int
) -> None:
    """
    验证音频长度

    Args:
        audio: 音频数据
        sample_rate: 采样率

    Raises:
        ValueError: 音频长度不符合要求
    """
    duration = len(audio) / sample_rate

    if duration < settings.MIN_AUDIO_LENGTH:
        raise ValueError(
            f"音频太短: {duration:.2f}s, 最少需要 {settings.MIN_AUDIO_LENGTH}s"
        )

    if duration > settings.MAX_AUDIO_LENGTH:
        raise ValueError(
            f"音频太长: {duration:.2f}s, 最多支持 {settings.MAX_AUDIO_LENGTH}s"
        )

    logger.debug(f"音频长度验证通过: {duration:.2f}s")


def normalize_audio(audio: np.ndarray) -> np.ndarray:
    """
    归一化音频

    Args:
        audio: 音频数据

    Returns:
        归一化后的音频数据
    """
    max_val = np.abs(audio).max()
    if max_val > 0:
        audio = audio / max_val
    return audio


def compute_audio_features(
    audio: np.ndarray,
    sample_rate: int
) -> dict:
    """
    计算音频特征（用于质量评估）

    Args:
        audio: 音频数据
        sample_rate: 采样率

    Returns:
        特征字典
    """
    features = {}

    # 基本统计
    features['duration'] = len(audio) / sample_rate
    features['max_amplitude'] = float(np.abs(audio).max())
    features['rms'] = float(np.sqrt(np.mean(audio ** 2)))

    # 零交叉率
    features['zero_crossing_rate'] = float(
        np.mean(librosa.zero_crossings(audio, pad=False))
    )

    # 能量
    features['energy'] = float(np.sum(audio ** 2))

    # 频谱质心
    spectral_centroids = librosa.feature.spectral_centroid(
        y=audio, sr=sample_rate
    )[0]
    features['spectral_centroid_mean'] = float(np.mean(spectral_centroids))

    return features


def calculate_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """
    计算两个声纹嵌入向量的相似度（余弦相似度）

    Args:
        embedding1: 声纹嵌入向量1
        embedding2: 声纹嵌入向量2

    Returns:
        相似度分数 (0-1)
    """
    # 确保是numpy数组
    emb1 = np.array(embedding1)
    emb2 = np.array(embedding2)

    # 归一化
    emb1_norm = emb1 / np.linalg.norm(emb1)
    emb2_norm = emb2 / np.linalg.norm(emb2)

    # 余弦相似度
    similarity = np.dot(emb1_norm, emb2_norm)

    # 转换到 0-1 范围
    similarity = (similarity + 1) / 2

    return float(similarity)


def format_response(
    success: bool,
    message: str,
    data: Optional[dict] = None,
    error: Optional[str] = None
) -> dict:
    """
    格式化响应

    Args:
        success: 是否成功
        message: 消息
        data: 数据
        error: 错误信息

    Returns:
        响应字典
    """
    response = {
        "success": success,
        "message": message
    }

    if data is not None:
        response["data"] = data

    if error is not None:
        response["error"] = error

    return response
