# FunASR 服务部署指南

## 简介

FunASR 是阿里达摩院开源的语音识别框架，支持高精度的中文语音识别。本项目使用 FunASR 作为语音转文字的核心服务。

## 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

## 快速开始

### 1. 准备模型文件

首次启动前需要下载模型文件。可以通过两种方式：

#### 方式一：自动下载（推荐）

FunASR 会在首次运行时自动从 ModelScope 下载模型，模型会缓存到 `./funasr/cache` 目录。

```bash
# 直接启动，模型会自动下载
cd /Users/xyli/Documents/Code/CodingWithHennessy
docker compose -f docker/docker-compose.funasr.yml up -d
```

#### 方式二：手动下载

```bash
# 创建模型目录
mkdir -p docker/funasr/models

# 使用 ModelScope CLI 下载模型
pip install modelscope

# 下载语音识别模型（可选，自动下载也可以）
modelscope download --model damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch --local_dir docker/funasr/models/
```

### 2. 启动服务

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy

# 启动 FunASR 服务
docker compose -f docker/docker-compose.funasr.yml up -d

# 查看日志
docker compose -f docker/docker-compose.funasr.yml logs -f funasr

# 检查服务状态
docker compose -f docker/docker-compose.funasr.yml ps
```

### 3. 验证服务

```bash
# 健康检查
curl http://localhost:10095/api/health

# 测试语音识别（需要准备测试音频文件）
curl -X POST http://localhost:10095/api/v1/asr \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@test.wav" \
  -F "format=wav" \
  -F "sample_rate=16000"
```

## 配置说明

### 环境变量

- `MODEL_DIR`: 模型存储目录（默认：/workspace/models）
- `DEVICE`: 运行设备（cpu 或 cuda）
- `LOG_LEVEL`: 日志级别（debug, info, warning, error）

### 端口说明

- `10095`: HTTP API 端口
- `10096`: WebSocket 端口（用于实时转录）

### 资源限制

- CPU: 最多使用 4 核心
- 内存: 最多使用 4GB

## 使用的模型

FunASR 服务默认使用以下模型：

1. **Paraformer-large** (语音识别)
   - ModelScope ID: `damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch`
   - 精度高，支持中文
   - 支持标点符号和逆文本归一化

2. **FSMN-VAD** (语音活动检测，可选)
   - ModelScope ID: `damo/speech_fsmn_vad_zh-cn-16k-common-pytorch`
   - 用于检测语音段落

3. **CT-Transformer** (标点恢复，可选)
   - ModelScope ID: `damo/punc_ct-transformer_zh-cn-common-vocab272727-pytorch`
   - 自动添加标点符号

## API 接口

### 1. 文件转录

```bash
POST /api/v1/asr

Content-Type: multipart/form-data

参数:
- audio: 音频文件
- format: 音频格式 (wav, mp3, m4a, etc.)
- sample_rate: 采样率 (16000 推荐)
- language: 语言 (zh-cn)

返回:
{
  "code": 0,
  "message": "success",
  "result": {
    "text": "识别的文本内容",
    "duration": 12.5,
    "confidence": 0.95
  }
}
```

### 2. 实时转录

```bash
WebSocket ws://localhost:10096/ws/v1/asr

发送消息格式:
{
  "type": "start",
  "data": {
    "format": "pcm",
    "sample_rate": 16000,
    "language": "zh-cn"
  }
}

接收消息格式:
{
  "type": "result",
  "data": {
    "text": "识别的文本",
    "is_final": false,
    "confidence": 0.92
  }
}
```

### 3. 健康检查

```bash
GET /api/health

返回:
{
  "status": "ok",
  "version": "0.4.5",
  "models_loaded": true
}
```

## 故障排查

### 问题1：容器启动失败

```bash
# 查看详细日志
docker compose -f docker/docker-compose.funasr.yml logs funasr

# 常见原因：
# 1. 端口被占用
# 2. 内存不足
# 3. 模型下载失败
```

### 问题2：模型下载缓慢

```bash
# 使用国内镜像加速
export HF_ENDPOINT=https://hf-mirror.com

# 或使用阿里云镜像
docker pull registry.cn-hangzhou.aliyuncs.com/funasr_repo/funasr:funasr-runtime-sdk-cpu-0.4.5
```

### 问题3：识别效果不佳

检查音频格式：
- 采样率：16kHz 最佳
- 声道：单声道
- 位深：16bit
- 格式：WAV/PCM 推荐

### 问题4：CPU 占用过高

```bash
# 调整 CPU 核心数
# 修改 docker-compose.funasr.yml 中的 ncpu 参数
command: |
  bash -c "
  python3 -m funasr.bin.funasr_server \
    --ncpu 2  # 减少 CPU 核心数
    ...
  "
```

## 性能优化建议

1. **音频预处理**
   - 在发送前将音频转换为 16kHz/16bit/mono
   - 使用 WAV 或 PCM 格式以减少解码开销

2. **批处理**
   - 对于批量文件，考虑使用队列处理
   - 避免同时发送过多请求

3. **缓存**
   - 对重复的音频文件缓存识别结果
   - 使用 Redis 存储识别结果

## 停止和清理

```bash
# 停止服务
docker compose -f docker/docker-compose.funasr.yml down

# 停止并删除数据（谨慎操作）
docker compose -f docker/docker-compose.funasr.yml down -v

# 清理未使用的镜像
docker image prune -f
```

## 更新服务

```bash
# 拉取最新镜像
docker compose -f docker/docker-compose.funasr.yml pull

# 重启服务
docker compose -f docker/docker-compose.funasr.yml up -d --force-recreate
```

## 参考资料

- [FunASR GitHub](https://github.com/alibaba-damo-academy/FunASR)
- [FunASR 文档](https://alibaba-damo-academy.github.io/FunASR/)
- [ModelScope 模型库](https://modelscope.cn/)

## 支持与反馈

如遇到问题，请查看：
1. Docker 日志
2. FunASR 官方文档
3. 项目 Issue 区
