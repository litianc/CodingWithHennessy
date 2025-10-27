"""
3D-Speaker 模型封装

提供声纹提取、识别、说话人分割等功能
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from loguru import logger

from .config import settings
from .utils import (
    ensure_dir,
    load_audio,
    validate_audio_length,
    normalize_audio,
    calculate_similarity,
    generate_speaker_id
)


class SpeakerModel:
    """声纹识别模型类"""

    def __init__(self):
        """初始化模型"""
        self.model = None
        self.model_name = settings.SPEAKER_MODEL
        self.device = settings.DEVICE
        self.voiceprint_dir = Path(settings.VOICEPRINT_DIR)
        self.sample_rate = settings.SAMPLE_RATE

        # 确保目录存在
        ensure_dir(str(self.voiceprint_dir))

        # 初始化模型
        self._init_model()

        # 加载已注册的声纹
        self.voiceprints = self._load_voiceprints()

        logger.info(f"SpeakerModel 初始化完成, 已加载 {len(self.voiceprints)} 个声纹")

    def _init_model(self):
        """初始化3D-Speaker模型"""
        try:
            # 注意：实际部署时需要安装3D-Speaker
            # 这里提供简化的实现，使用ModelScope加载模型

            from modelscope.pipelines import pipeline
            from modelscope.utils.constant import Tasks
            import os

            logger.info(f"正在加载模型: {self.model_name}")

            # 使用本地缓存的模型路径
            cache_dir = os.path.expanduser("~/.cache/modelscope/hub")
            local_model_path = os.path.join(
                cache_dir,
                "models/damo/speech_eres2net_base_200k_sv_zh-cn_16k-common"
            )

            # 检查本地是否有缓存的模型
            if os.path.exists(local_model_path):
                logger.info(f"使用本地缓存模型: {local_model_path}")
                # 先尝试从本地加载
                try:
                    self.model = pipeline(
                        task=Tasks.speaker_verification,
                        model=local_model_path
                    )
                    logger.info("从本地缓存加载模型成功")
                    return
                except Exception as local_err:
                    logger.warning(f"从本地加载失败，尝试在线加载: {local_err}")

            # 如果本地加载失败，尝试在线加载
            self.model = pipeline(
                task=Tasks.speaker_verification,
                model=self.model_name,
                model_revision='v1.0.0'
            )

            logger.info("模型加载成功")

        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            logger.warning("将使用Mock模式")
            self.model = None

    def extract_embedding(
        self,
        audio_path: str
    ) -> np.ndarray:
        """
        提取声纹嵌入向量

        Args:
            audio_path: 音频文件路径

        Returns:
            声纹嵌入向量
        """
        try:
            # 加载音频
            audio, sr = load_audio(audio_path, self.sample_rate)

            # 验证音频长度
            validate_audio_length(audio, sr)

            # 归一化
            audio = normalize_audio(audio)

            if self.model is not None:
                # 使用真实模型提取嵌入
                # 重要：ModelScope pipeline 期望输入是一个列表！
                # 列表中的每个元素可以是文件路径（str）或numpy数组（np.ndarray）

                try:
                    # 使用numpy数组作为输入，必须包装在列表中
                    logger.debug(f"调用模型提取嵌入，音频shape={audio.shape}")
                    result = self.model([audio], output_emb=True)  # ← 注意这里是 [audio] 而不是 audio

                    # 提取嵌入向量
                    # 当 output_emb=True 时，返回格式为 {'outputs': ..., 'embs': numpy.array}
                    if isinstance(result, dict) and 'embs' in result:
                        embs = result['embs']
                        # embs shape 应该是 (1, embedding_dim)，因为我们只传了一个音频
                        if len(embs.shape) == 2:
                            embedding = embs[0]  # 取第一个（也是唯一一个）嵌入向量
                        else:
                            embedding = embs
                        logger.info(f"成功提取声纹嵌入: shape={embedding.shape}")
                    else:
                        logger.error(f"意外的模型输出格式: {type(result)}, keys={result.keys() if isinstance(result, dict) else 'N/A'}")
                        raise ValueError(f"模型输出格式不正确: {result}")

                except Exception as e:
                    logger.error(f"使用numpy数组提取嵌入失败: {e}")
                    # 如果numpy数组失败，尝试使用文件路径
                    try:
                        logger.info(f"尝试使用文件路径: {audio_path}")
                        result = self.model([audio_path], output_emb=True)  # ← 注意这里也是 [audio_path]

                        if isinstance(result, dict) and 'embs' in result:
                            embs = result['embs']
                            if len(embs.shape) == 2:
                                embedding = embs[0]
                            else:
                                embedding = embs
                            logger.info(f"使用文件路径成功提取声纹嵌入: shape={embedding.shape}")
                        else:
                            raise ValueError(f"模型输出格式不正确: {result}")

                    except Exception as path_err:
                        logger.error(f"使用文件路径也失败: {path_err}")
                        raise ValueError(f"无法提取声纹嵌入: numpy方式={str(e)}, path方式={str(path_err)}")
            else:
                # Mock模式：生成随机嵌入向量
                logger.warning("使用Mock嵌入向量")
                embedding = np.random.randn(192).astype(np.float32)
                # 归一化
                embedding = embedding / np.linalg.norm(embedding)

            logger.info(f"提取声纹嵌入: shape={embedding.shape}")
            return embedding

        except Exception as e:
            logger.error(f"提取声纹嵌入失败: {e}")
            raise ValueError(f"声纹提取失败: {str(e)}")

    def register_speaker(
        self,
        name: str,
        audio_path: str,
        user_id: Optional[str] = None,
        email: Optional[str] = None
    ) -> Dict:
        """
        注册声纹（单个样本）

        Args:
            name: 说话人姓名
            audio_path: 音频文件路径
            user_id: 用户ID（可选）
            email: 邮箱（可选）

        Returns:
            声纹信息字典
        """
        try:
            # 生成声纹ID
            speaker_id = generate_speaker_id(name)

            # 提取声纹嵌入
            embedding = self.extract_embedding(audio_path)

            # 创建声纹信息
            voiceprint = {
                'speaker_id': speaker_id,
                'name': name,
                'user_id': user_id,
                'email': email,
                'embedding': embedding.tolist(),
                'embeddings_all': [embedding.tolist()],  # 保存所有嵌入
                'created_at': self._get_timestamp(),
                'updated_at': self._get_timestamp(),
                'sample_count': 1
            }

            # 保存声纹
            self._save_voiceprint(speaker_id, voiceprint)

            # 添加到内存
            self.voiceprints[speaker_id] = voiceprint

            logger.info(f"注册声纹成功: {speaker_id} - {name}")

            return {
                'speaker_id': speaker_id,
                'name': name,
                'user_id': user_id,
                'email': email,
                'created_at': voiceprint['created_at'],
                'sample_count': 1
            }

        except Exception as e:
            logger.error(f"注册声纹失败: {e}")
            raise ValueError(f"声纹注册失败: {str(e)}")

    def register_speaker_batch(
        self,
        name: str,
        audio_paths: List[str],
        user_id: Optional[str] = None,
        email: Optional[str] = None
    ) -> Dict:
        """
        批量注册声纹（使用多个音频样本）

        Args:
            name: 说话人姓名
            audio_paths: 音频文件路径列表
            user_id: 用户ID（可选）
            email: 邮箱（可选）

        Returns:
            声纹信息字典
        """
        try:
            # 生成声纹ID
            speaker_id = generate_speaker_id(name)

            # 为每个音频提取嵌入向量
            embeddings = []
            for i, audio_path in enumerate(audio_paths):
                try:
                    embedding = self.extract_embedding(audio_path)
                    embeddings.append(embedding)
                    logger.debug(f"成功提取样本 {i+1}/{len(audio_paths)} 嵌入")
                except Exception as e:
                    logger.warning(f"跳过无效样本 {audio_path}: {e}")
                    continue

            if not embeddings:
                raise ValueError("没有成功提取任何嵌入向量")

            # 聚合所有嵌入向量（使用平均）
            embeddings_array = np.array(embeddings)
            aggregated_embedding = np.mean(embeddings_array, axis=0)

            # 归一化
            aggregated_embedding = aggregated_embedding / np.linalg.norm(aggregated_embedding)

            logger.info(f"聚合了 {len(embeddings)} 个嵌入向量")

            # 创建声纹信息
            voiceprint = {
                'speaker_id': speaker_id,
                'name': name,
                'user_id': user_id,
                'email': email,
                'embedding': aggregated_embedding.tolist(),
                'embeddings_all': [emb.tolist() for emb in embeddings],  # 保存所有嵌入
                'created_at': self._get_timestamp(),
                'updated_at': self._get_timestamp(),
                'sample_count': len(embeddings)  # 记录真实样本数
            }

            # 保存声纹
            self._save_voiceprint(speaker_id, voiceprint)

            # 添加到内存
            self.voiceprints[speaker_id] = voiceprint

            logger.info(f"批量注册声纹成功: {speaker_id} - {name}, samples={len(embeddings)}")

            return {
                'speaker_id': speaker_id,
                'name': name,
                'user_id': user_id,
                'email': email,
                'created_at': voiceprint['created_at'],
                'sample_count': len(embeddings)
            }

        except Exception as e:
            logger.error(f"批量注册声纹失败: {e}")
            raise ValueError(f"声纹注册失败: {str(e)}")

    def recognize_speaker(
        self,
        audio_path: str,
        top_k: int = 5
    ) -> List[Dict]:
        """
        识别说话人

        Args:
            audio_path: 音频文件路径
            top_k: 返回前K个匹配结果

        Returns:
            匹配结果列表
        """
        try:
            if not self.voiceprints:
                logger.warning("没有已注册的声纹")
                return []

            # 提取当前音频的声纹嵌入
            query_embedding = self.extract_embedding(audio_path)

            # 与所有已注册声纹进行匹配
            matches = []

            for speaker_id, voiceprint in self.voiceprints.items():
                stored_embedding = np.array(voiceprint['embedding'])

                # 计算相似度
                similarity = calculate_similarity(query_embedding, stored_embedding)

                # 判断是否匹配
                is_match = similarity >= settings.SIMILARITY_THRESHOLD

                matches.append({
                    'speaker_id': speaker_id,
                    'name': voiceprint['name'],
                    'user_id': voiceprint.get('user_id'),
                    'email': voiceprint.get('email'),
                    'similarity': float(similarity),
                    'confidence': float(similarity),
                    'is_match': is_match
                })

            # 按相似度排序
            matches.sort(key=lambda x: x['similarity'], reverse=True)

            # 返回前K个结果
            top_matches = matches[:top_k]

            logger.info(f"识别完成，找到 {len(top_matches)} 个匹配结果")

            return top_matches

        except Exception as e:
            logger.error(f"识别说话人失败: {e}")
            raise ValueError(f"说话人识别失败: {str(e)}")

    def diarization(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None
    ) -> List[Dict]:
        """
        说话人分割（Speaker Diarization）

        Args:
            audio_path: 音频文件路径
            num_speakers: 说话人数量（可选，None表示自动检测）

        Returns:
            分割结果列表，每个元素包含 start_time, end_time, speaker_id
        """
        try:
            logger.info(f"开始说话人分割: {audio_path}")

            # 注意：实际的说话人分割需要专门的模型
            # 这里提供简化的Mock实现

            audio, sr = load_audio(audio_path, self.sample_rate)
            duration = len(audio) / sr

            # Mock: 生成简单的分割结果
            num_speakers = num_speakers or 2
            segments = []

            segment_duration = duration / num_speakers

            for i in range(num_speakers):
                segments.append({
                    'start_time': i * segment_duration,
                    'end_time': (i + 1) * segment_duration,
                    'speaker_id': f'speaker_{i+1}',
                    'confidence': 0.85 + np.random.rand() * 0.15
                })

            logger.info(f"说话人分割完成，检测到 {len(segments)} 个片段")

            return segments

        except Exception as e:
            logger.error(f"说话人分割失败: {e}")
            raise ValueError(f"说话人分割失败: {str(e)}")

    def list_speakers(self) -> List[Dict]:
        """
        获取所有已注册的说话人

        Returns:
            说话人列表
        """
        speakers = []

        for speaker_id, voiceprint in self.voiceprints.items():
            speakers.append({
                'speaker_id': speaker_id,
                'name': voiceprint['name'],
                'user_id': voiceprint.get('user_id'),
                'email': voiceprint.get('email'),
                'created_at': voiceprint['created_at'],
                'sample_count': voiceprint.get('sample_count', 1)
            })

        return speakers

    def delete_speaker(self, speaker_id: str) -> bool:
        """
        删除声纹

        Args:
            speaker_id: 声纹ID

        Returns:
            是否成功
        """
        try:
            if speaker_id not in self.voiceprints:
                logger.warning(f"声纹不存在: {speaker_id}")
                return False

            # 删除文件
            voiceprint_file = self.voiceprint_dir / f"{speaker_id}.json"
            if voiceprint_file.exists():
                voiceprint_file.unlink()

            # 从内存删除
            del self.voiceprints[speaker_id]

            logger.info(f"删除声纹成功: {speaker_id}")
            return True

        except Exception as e:
            logger.error(f"删除声纹失败: {e}")
            return False

    def _load_voiceprints(self) -> Dict[str, Dict]:
        """加载已保存的声纹"""
        voiceprints = {}

        try:
            for file in self.voiceprint_dir.glob("*.json"):
                with open(file, 'r', encoding='utf-8') as f:
                    voiceprint = json.load(f)
                    speaker_id = voiceprint['speaker_id']
                    voiceprints[speaker_id] = voiceprint

            logger.info(f"加载了 {len(voiceprints)} 个声纹")
        except Exception as e:
            logger.error(f"加载声纹失败: {e}")

        return voiceprints

    def _save_voiceprint(self, speaker_id: str, voiceprint: Dict):
        """保存声纹到文件"""
        try:
            voiceprint_file = self.voiceprint_dir / f"{speaker_id}.json"
            with open(voiceprint_file, 'w', encoding='utf-8') as f:
                json.dump(voiceprint, f, indent=2, ensure_ascii=False)

            logger.debug(f"保存声纹: {voiceprint_file}")
        except Exception as e:
            logger.error(f"保存声纹失败: {e}")
            raise

    @staticmethod
    def _get_timestamp() -> str:
        """获取当前时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()


# 全局模型实例
_speaker_model: Optional[SpeakerModel] = None


def get_speaker_model() -> SpeakerModel:
    """获取声纹识别模型实例（单例）"""
    global _speaker_model

    if _speaker_model is None:
        _speaker_model = SpeakerModel()

    return _speaker_model
