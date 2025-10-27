# 3D-Speaker 注册逻辑改进方案

## 🔍 当前问题分析

### 问题1: 接口只支持单文件上传

**位置**: `speaker_service/app.py` 第142-148行

```python
async def register_speaker(
    name: str = Form(...),
    audio: UploadFile = File(...),  # ← 问题：只接收一个文件
    user_id: Optional[str] = Form(None),
    email: Optional[str] = Form(None)
):
```

**影响**:
- 无法一次上传多个音频样本
- 需要多次调用API才能注册多个样本
- 每次调用会覆盖之前的数据

### 问题2: sample_count 硬编码

**位置**: `speaker_service/speaker_model.py` 第200-210行

```python
voiceprint = {
    'speaker_id': speaker_id,
    'name': name,
    'user_id': user_id,
    'email': email,
    'embedding': embedding.tolist(),  # ← 只保存一个嵌入向量
    'created_at': self._get_timestamp(),
    'updated_at': self._get_timestamp(),
    'sample_count': 1  # ← 硬编码为1，不累加
}
```

**影响**:
- 无法记录真实的样本数量
- 无法利用多个样本提升识别准确率
- 多次注册同一个人会覆盖数据

### 问题3: 缺失多样本聚合

3D-Speaker 的最佳实践是：
1. 收集3-10个音频样本
2. 为每个样本提取嵌入向量
3. 聚合所有嵌入（平均/加权平均）
4. 使用聚合后的嵌入进行识别

**当前缺失**:
- ❌ 没有多嵌入向量的存储机制
- ❌ 没有嵌入向量的聚合算法
- ❌ 没有样本追加功能

## ✅ 改进方案

### 方案A: 支持批量上传（推荐）

#### 1. 修改API接口

```python
@app.post("/api/speaker/register", tags=["Speaker"])
async def register_speaker(
    name: str = Form(...),
    audio_files: List[UploadFile] = File(...),  # ← 改为列表
    user_id: Optional[str] = Form(None),
    email: Optional[str] = Form(None)
):
    """
    注册声纹（支持多个音频样本）

    Args:
        name: 说话人姓名
        audio_files: 音频文件列表（建议3-10个）
        user_id: 用户ID（可选）
        email: 邮箱（可选）
    """
    try:
        logger.info(f"收到声纹注册请求: name={name}, samples={len(audio_files)}")

        if len(audio_files) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="至少需要3个音频样本以确保声纹质量"
            )

        if len(audio_files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="音频样本数量不能超过10个"
            )

        # 保存所有上传的音频文件
        temp_files = []
        try:
            for audio in audio_files:
                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=Path(audio.filename).suffix
                ) as temp_file:
                    content = await audio.read()
                    temp_file.write(content)
                    temp_files.append(temp_file.name)

            # 使用多个样本注册声纹
            model = get_speaker_model()
            result = model.register_speaker_batch(
                name=name,
                audio_paths=temp_files,
                user_id=user_id,
                email=email
            )

            logger.info(f"声纹注册成功: {result['speaker_id']}, samples={len(temp_files)}")

            return JSONResponse(
                content=format_response(
                    success=True,
                    message="声纹注册成功",
                    data=result
                )
            )

        finally:
            # 清理临时文件
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"声纹注册异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"声纹注册失败: {str(e)}"
        )
```

#### 2. 添加批量注册方法

在 `speaker_model.py` 中添加：

```python
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
        for audio_path in audio_paths:
            try:
                embedding = self.extract_embedding(audio_path)
                embeddings.append(embedding)
                logger.debug(f"成功提取样本嵌入: {audio_path}")
            except Exception as e:
                logger.warning(f"跳过无效样本 {audio_path}: {e}")
                continue

        if not embeddings:
            raise ValueError("没有成功提取任何嵌入向量")

        if len(embeddings) < 3:
            raise ValueError(f"有效样本不足3个（当前: {len(embeddings)}）")

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
```

#### 3. 添加样本追加功能

```python
@app.post("/api/speaker/{speaker_id}/samples", tags=["Speaker"])
async def add_samples(
    speaker_id: str,
    audio_files: List[UploadFile] = File(...)
):
    """
    为已注册的说话人添加更多音频样本

    Args:
        speaker_id: 声纹ID
        audio_files: 音频文件列表
    """
    try:
        model = get_speaker_model()

        # 检查说话人是否存在
        if speaker_id not in model.voiceprints:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="说话人不存在"
            )

        # 保存并处理新样本
        temp_files = []
        try:
            for audio in audio_files:
                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=Path(audio.filename).suffix
                ) as temp_file:
                    content = await audio.read()
                    temp_file.write(content)
                    temp_files.append(temp_file.name)

            # 添加新样本
            result = model.add_samples(speaker_id, temp_files)

            return JSONResponse(
                content=format_response(
                    success=True,
                    message="样本添加成功",
                    data=result
                )
            )

        finally:
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"添加样本失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"添加样本失败: {str(e)}"
        )
```

### 方案B: 保持当前接口，优化累加逻辑

如果不想大改接口，可以：

1. **检查同名说话人**: 在注册时检查是否已存在同名说话人
2. **追加模式**: 如果存在，则追加样本而不是覆盖
3. **重新聚合**: 聚合所有历史样本的嵌入向量

```python
def register_speaker(
    self,
    name: str,
    audio_path: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    mode: str = "append"  # "append" 或 "overwrite"
) -> Dict:
    """注册声纹（支持追加模式）"""

    # 生成speaker_id
    speaker_id = generate_speaker_id(name)

    # 提取新样本的嵌入
    new_embedding = self.extract_embedding(audio_path)

    # 检查是否已存在
    if speaker_id in self.voiceprints and mode == "append":
        # 追加模式：获取现有嵌入
        existing = self.voiceprints[speaker_id]
        existing_embeddings = existing.get('embeddings_all', [existing['embedding']])

        # 添加新嵌入
        all_embeddings = [np.array(emb) for emb in existing_embeddings]
        all_embeddings.append(new_embedding)

        # 重新聚合
        aggregated = np.mean(all_embeddings, axis=0)
        aggregated = aggregated / np.linalg.norm(aggregated)

        # 更新声纹
        voiceprint = existing.copy()
        voiceprint['embedding'] = aggregated.tolist()
        voiceprint['embeddings_all'] = [emb.tolist() for emb in all_embeddings]
        voiceprint['sample_count'] = len(all_embeddings)
        voiceprint['updated_at'] = self._get_timestamp()
    else:
        # 新建或覆盖模式
        voiceprint = {
            'speaker_id': speaker_id,
            'name': name,
            'user_id': user_id,
            'email': email,
            'embedding': new_embedding.tolist(),
            'embeddings_all': [new_embedding.tolist()],
            'created_at': self._get_timestamp(),
            'updated_at': self._get_timestamp(),
            'sample_count': 1
        }

    # 保存
    self._save_voiceprint(speaker_id, voiceprint)
    self.voiceprints[speaker_id] = voiceprint

    return {
        'speaker_id': speaker_id,
        'name': name,
        'user_id': user_id,
        'email': email,
        'created_at': voiceprint['created_at'],
        'sample_count': voiceprint['sample_count']
    }
```

## 📊 对比

| 特性 | 当前实现 | 方案A (批量) | 方案B (追加) |
|------|---------|------------|------------|
| 多样本支持 | ❌ | ✅ | ✅ |
| sample_count准确 | ❌ | ✅ | ✅ |
| 嵌入聚合 | ❌ | ✅ | ✅ |
| API变更 | - | 较大 | 较小 |
| 兼容性 | - | 需要改前端 | 向后兼容 |
| 推荐度 | - | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🎯 推荐行动

### 短期（立即可做）

1. **使用方案B**: 添加追加模式，向后兼容
2. **文档化**: 说明当前每次只能注册1个样本
3. **前端提示**: 建议用户多次上传同一个人的音频

### 长期（建议实施）

1. **实施方案A**: 支持批量上传
2. **优化前端**: 一次选择多个文件
3. **增强功能**: 样本质量评估、自动去重

---

**作者**: Claude Code
**日期**: 2025-10-24
**状态**: 待实施
