# Python Services

本目录包含用 Python 实现的 AI 服务，包括：

- **speaker_service**: 3D-Speaker 声纹识别服务

## 目录结构

```
python-services/
├── speaker_service/        # 3D-Speaker 声纹识别服务
│   ├── __init__.py
│   ├── app.py             # FastAPI 应用主文件
│   ├── speaker_model.py   # 3D-Speaker 模型封装
│   ├── config.py          # 配置管理
│   └── utils.py           # 工具函数
├── models/                # AI 模型文件（自动下载）
├── voiceprints/           # 声纹数据存储
├── logs/                  # 日志文件
├── requirements.txt       # Python 依赖
├── setup.sh              # 环境安装脚本
└── README.md             # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
cd backend/python-services

# 方式一：使用安装脚本（推荐）
bash setup.sh

# 方式二：手动安装
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 配置服务

编辑 `.env` 文件（setup.sh 会自动创建）：

```bash
# 基本配置
SPEAKER_HOST=0.0.0.0
SPEAKER_PORT=5002
SPEAKER_DEVICE=cpu  # 或 cuda

# 模型配置
SPEAKER_SPEAKER_MODEL=damo/speech_eres2net_base_200k_sv_zh-cn_16k-common

# 识别参数
SPEAKER_SIMILARITY_THRESHOLD=0.75
```

### 3. 启动服务

```bash
# 激活虚拟环境
source venv/bin/activate

# 启动 3D-Speaker 服务
python -m speaker_service.app

# 或使用 uvicorn
uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002 --reload
```

### 4. 验证服务

```bash
# 健康检查
curl http://localhost:5002/api/health

# 查看 API 文档
# 浏览器访问: http://localhost:5002/docs
```

## 3D-Speaker 服务

### API 接口

#### 1. 健康检查

```bash
GET /api/health

返回:
{
  "status": "ok",
  "version": "1.0.0",
  "model_loaded": true,
  "registered_speakers": 5
}
```

#### 2. 注册声纹

```bash
POST /api/speaker/register

参数:
- name: 说话人姓名
- audio: 音频文件
- user_id: 用户ID（可选）
- email: 邮箱（可选）

返回:
{
  "success": true,
  "message": "声纹注册成功",
  "data": {
    "speaker_id": "abc123...",
    "name": "张三",
    "user_id": "user_001",
    "email": "zhangsan@example.com",
    "created_at": "2024-01-01T12:00:00"
  }
}
```

#### 3. 识别说话人

```bash
POST /api/speaker/recognize

参数:
- audio: 音频文件
- top_k: 返回前K个匹配结果（默认5）

返回:
{
  "success": true,
  "message": "声纹识别完成",
  "data": {
    "matches": [
      {
        "speaker_id": "abc123...",
        "name": "张三",
        "similarity": 0.95,
        "confidence": 0.95,
        "is_match": true
      }
    ],
    "count": 1
  }
}
```

#### 4. 说话人分割

```bash
POST /api/speaker/diarization

参数:
- audio: 音频文件
- num_speakers: 说话人数量（可选）

返回:
{
  "success": true,
  "message": "说话人分割完成",
  "data": {
    "segments": [
      {
        "start_time": 0.0,
        "end_time": 5.5,
        "speaker_id": "speaker_1",
        "confidence": 0.92
      }
    ],
    "count": 1
  }
}
```

#### 5. 获取说话人列表

```bash
GET /api/speaker/list

返回:
{
  "success": true,
  "message": "查询成功",
  "data": {
    "speakers": [
      {
        "speaker_id": "abc123...",
        "name": "张三",
        "user_id": "user_001",
        "email": "zhangsan@example.com",
        "created_at": "2024-01-01T12:00:00",
        "sample_count": 1
      }
    ],
    "count": 1
  }
}
```

#### 6. 删除声纹

```bash
DELETE /api/speaker/{speaker_id}

返回:
{
  "success": true,
  "message": "声纹删除成功"
}
```

### 使用示例

#### Python 示例

```python
import requests

# 注册声纹
with open('audio.wav', 'rb') as f:
    files = {'audio': f}
    data = {'name': '张三', 'user_id': 'user_001'}
    response = requests.post(
        'http://localhost:5002/api/speaker/register',
        files=files,
        data=data
    )
    print(response.json())

# 识别说话人
with open('test.wav', 'rb') as f:
    files = {'audio': f}
    data = {'top_k': 5}
    response = requests.post(
        'http://localhost:5002/api/speaker/recognize',
        files=files,
        data=data
    )
    print(response.json())
```

#### cURL 示例

```bash
# 注册声纹
curl -X POST http://localhost:5002/api/speaker/register \
  -F "name=张三" \
  -F "user_id=user_001" \
  -F "audio=@audio.wav"

# 识别说话人
curl -X POST http://localhost:5002/api/speaker/recognize \
  -F "audio=@test.wav" \
  -F "top_k=5"
```

### 音频要求

- **格式**: WAV, MP3, M4A 等常见格式
- **采样率**: 16kHz（推荐）
- **声道**: 单声道（推荐）
- **时长**: 0.5秒 - 30秒

## 开发指南

### 添加新功能

1. 在 `speaker_model.py` 中添加模型功能
2. 在 `app.py` 中添加 API 路由
3. 更新 API 文档

### 调试

```bash
# 启用调试模式
export SPEAKER_DEBUG=True

# 查看详细日志
tail -f logs/speaker_service.log
```

### 测试

```bash
# 运行测试（需要添加测试文件）
pytest tests/
```

## 性能优化

### CPU 模式

- 使用轻量级模型
- 限制并发请求数
- 使用音频缓存

### GPU 模式

如果有 GPU 可用：

```bash
# 修改 .env
SPEAKER_DEVICE=cuda

# 确保安装了 CUDA 版本的 PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## 故障排查

### 问题1：模型加载失败

```bash
# 检查 ModelScope 缓存
ls ~/.cache/modelscope/

# 手动下载模型
python -c "
from modelscope import snapshot_download
model_dir = snapshot_download('damo/speech_eres2net_base_200k_sv_zh-cn_16k-common')
print(f'Model downloaded to: {model_dir}')
"
```

### 问题2：内存不足

- 减少 workers 数量
- 使用更小的模型
- 限制音频文件大小

### 问题3：识别效果不佳

- 检查音频质量
- 确保采样率为 16kHz
- 使用清晰的语音样本注册

## 参考资料

- [3D-Speaker GitHub](https://github.com/alibaba-damo-academy/3D-Speaker)
- [ModelScope](https://modelscope.cn/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)

## 许可证

MIT License
