"""
工具函数
"""
import os
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Tuple
from loguru import logger


def ensure_dir(directory: str):
    """确保目录存在"""
    Path(directory).mkdir(parents=True, exist_ok=True)


def load_audio(
    audio_path: str,
    target_sr: int = 16000
) -> Tuple[np.ndarray, int]:
    """
    加载音频文件

    Args:
        audio_path: 音频文件路径
        target_sr: 目标采样率

    Returns:
        (音频数据, 采样率)
    """
    try:
        # 使用librosa加载音频
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        logger.debug(f"加载音频: {audio_path}, 时长: {len(audio)/sr:.2f}秒")
        return audio, sr
    except Exception as e:
        logger.error(f"加载音频失败: {e}")
        raise ValueError(f"无法加载音频文件: {str(e)}")


def validate_audio_length(
    audio: np.ndarray,
    sr: int,
    min_length: float = 0.5,
    max_length: float = 600.0
):
    """
    验证音频长度

    Args:
        audio: 音频数据
        sr: 采样率
        min_length: 最短时长（秒）
        max_length: 最长时长（秒）

    Raises:
        ValueError: 音频长度不符合要求
    """
    duration = len(audio) / sr

    if duration < min_length:
        raise ValueError(f"音频太短，最少需要 {min_length} 秒（当前 {duration:.2f} 秒）")

    if duration > max_length:
        raise ValueError(f"音频太长，最多支持 {max_length} 秒（当前 {duration:.2f} 秒）")


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


def save_audio(
    audio: np.ndarray,
    output_path: str,
    sr: int = 16000
):
    """
    保存音频文件

    Args:
        audio: 音频数据
        output_path: 输出路径
        sr: 采样率
    """
    try:
        sf.write(output_path, audio, sr)
        logger.debug(f"保存音频: {output_path}")
    except Exception as e:
        logger.error(f"保存音频失败: {e}")
        raise ValueError(f"无法保存音频文件: {str(e)}")


def get_audio_duration(audio_path: str) -> float:
    """
    获取音频时长

    Args:
        audio_path: 音频文件路径

    Returns:
        时长（秒）
    """
    try:
        import soundfile as sf
        info = sf.info(audio_path)
        return info.duration
    except Exception as e:
        logger.error(f"获取音频时长失败: {e}")
        # 备选方案：使用librosa
        try:
            audio, sr = librosa.load(audio_path, sr=None)
            return len(audio) / sr
        except Exception as e2:
            logger.error(f"备选方案也失败: {e2}")
            raise ValueError(f"无法获取音频时长: {str(e)}")


def format_timestamp(seconds: float) -> str:
    """
    格式化时间戳

    Args:
        seconds: 秒数

    Returns:
        格式化的时间字符串 (HH:MM:SS.mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
