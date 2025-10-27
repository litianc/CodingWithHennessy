"""
FunASR 模型封装

提供语音识别、VAD、标点符号预测等功能
"""
import os
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional, Union
from loguru import logger

from .config import settings
from .utils import (
    ensure_dir,
    load_audio,
    validate_audio_length,
    normalize_audio,
    format_timestamp
)


class ASRModel:
    """语音识别模型类"""

    def __init__(self):
        """初始化模型"""
        self.model = None
        self.model_name = settings.ASR_MODEL
        self.device = settings.DEVICE
        self.sample_rate = settings.SAMPLE_RATE

        # 初始化模型
        self._init_model()

        logger.info(f"ASRModel 初始化完成")

    def _init_model(self):
        """初始化FunASR模型"""
        try:
            from funasr import AutoModel
            import os

            logger.info(f"正在加载模型: {self.model_name}")

            # 使用本地缓存的模型路径
            cache_dir = os.path.expanduser("~/.cache/modelscope/hub/models")
            local_model_path = os.path.join(
                cache_dir,
                "damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
            )

            # 检查本地是否有缓存的模型
            if os.path.exists(local_model_path):
                logger.info(f"使用本地缓存模型: {local_model_path}")
                # 使用FunASR的AutoModel加载本地模型
                try:
                    self.model = AutoModel(
                        model=local_model_path,
                        device=self.device
                    )
                    logger.info("从本地缓存加载模型成功")
                    return
                except Exception as local_err:
                    logger.warning(f"从本地加载失败，尝试在线加载: {local_err}")

            # 如果本地加载失败，尝试在线加载
            self.model = AutoModel(
                model=self.model_name,
                device=self.device
            )

            logger.info("模型加载成功")

        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            logger.warning("将使用Mock模式")
            self.model = None

    def recognize(
        self,
        audio_path: str,
        enable_vad: bool = True,
        enable_punc: bool = True,
        enable_timestamp: bool = True
    ) -> Dict:
        """
        识别语音

        Args:
            audio_path: 音频文件路径
            enable_vad: 是否启用VAD（语音活动检测）
            enable_punc: 是否启用标点符号预测
            enable_timestamp: 是否生成时间戳

        Returns:
            识别结果字典
        """
        try:
            # 加载音频
            audio, sr = load_audio(audio_path, self.sample_rate)

            # 验证音频长度
            validate_audio_length(
                audio, sr,
                settings.MIN_AUDIO_LENGTH,
                settings.MAX_AUDIO_LENGTH
            )

            # 归一化
            audio = normalize_audio(audio)

            if self.model is not None:
                # 使用FunASR模型进行识别
                try:
                    logger.debug(f"调用FunASR模型进行识别，音频path={audio_path}")

                    # 使用FunASR的AutoModel进行推理
                    # generate方法可以接受文件路径、numpy数组或音频张量
                    result = self.model.generate(
                        input=audio_path,
                        batch_size_s=300,  # 批处理大小（秒）
                        hotword=""  # 热词，可以为空
                    )

                    logger.debug(f"模型返回结果类型: {type(result)}")
                    logger.debug(f"模型返回结果: {result}")

                    # FunASR返回格式: list of dict
                    # [{'text': '识别文本', 'timestamp': [[start_ms, end_ms, word], ...]}]
                    if isinstance(result, list) and len(result) > 0:
                        first_result = result[0]
                        text = first_result.get('text', '')
                        timestamp = first_result.get('timestamp', [])
                    else:
                        logger.error(f"意外的模型输出格式: {type(result)}")
                        text = str(result)
                        timestamp = []

                    logger.info(f"识别成功: {text[:50]}...")

                    # 构建返回结果
                    recognition_result = {
                        'text': text,
                        'duration': len(audio) / sr,
                        'sample_rate': sr
                    }

                    if enable_timestamp and timestamp:
                        recognition_result['timestamp'] = timestamp
                        # 格式化时间戳
                        recognition_result['segments'] = self._format_timestamps(timestamp, text)

                    return recognition_result

                except Exception as e:
                    logger.error(f"FunASR识别失败: {e}")
                    raise ValueError(f"语音识别失败: {str(e)}")
            else:
                # Mock模式：返回模拟结果
                logger.warning("使用Mock识别结果")
                duration = len(audio) / sr

                mock_text = "这是一段模拟的语音识别结果，用于测试。实际使用时会调用真实的FunASR模型进行识别。"

                recognition_result = {
                    'text': mock_text,
                    'duration': duration,
                    'sample_rate': sr
                }

                if enable_timestamp:
                    # 生成模拟的时间戳
                    recognition_result['segments'] = [
                        {
                            'start': 0.0,
                            'end': duration,
                            'text': mock_text
                        }
                    ]

                return recognition_result

        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            raise ValueError(f"语音识别失败: {str(e)}")

    def recognize_batch(
        self,
        audio_paths: List[str],
        enable_vad: bool = True,
        enable_punc: bool = True,
        enable_timestamp: bool = True
    ) -> List[Dict]:
        """
        批量识别语音

        Args:
            audio_paths: 音频文件路径列表
            enable_vad: 是否启用VAD
            enable_punc: 是否启用标点符号预测
            enable_timestamp: 是否生成时间戳

        Returns:
            识别结果列表
        """
        results = []

        for audio_path in audio_paths:
            try:
                result = self.recognize(
                    audio_path,
                    enable_vad=enable_vad,
                    enable_punc=enable_punc,
                    enable_timestamp=enable_timestamp
                )
                results.append({
                    'audio_path': audio_path,
                    'success': True,
                    'result': result
                })
            except Exception as e:
                logger.error(f"识别失败 {audio_path}: {e}")
                results.append({
                    'audio_path': audio_path,
                    'success': False,
                    'error': str(e)
                })

        return results

    def _format_timestamps(self, timestamp: List, text: str) -> List[Dict]:
        """
        格式化时间戳信息

        Args:
            timestamp: 原始时间戳信息
            text: 识别文本

        Returns:
            格式化后的片段列表
        """
        segments = []

        try:
            # timestamp 格式: [[start_ms, end_ms, word], ...]
            for item in timestamp:
                if isinstance(item, (list, tuple)) and len(item) >= 3:
                    start_ms, end_ms, word = item[0], item[1], item[2]
                    segments.append({
                        'start': start_ms / 1000.0,  # 转换为秒
                        'end': end_ms / 1000.0,
                        'text': word,
                        'start_time': format_timestamp(start_ms / 1000.0),
                        'end_time': format_timestamp(end_ms / 1000.0)
                    })
        except Exception as e:
            logger.warning(f"格式化时间戳失败: {e}")
            # 返回整体时间戳
            segments = [{
                'start': 0.0,
                'end': 0.0,
                'text': text
            }]

        return segments


# 全局模型实例
_asr_model: Optional[ASRModel] = None


def get_asr_model() -> ASRModel:
    """获取ASR模型实例（单例）"""
    global _asr_model

    if _asr_model is None:
        _asr_model = ASRModel()

    return _asr_model
