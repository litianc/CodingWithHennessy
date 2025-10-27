# FunASR + 3D-Speaker 快速启动指南

## 🚀 快速开始

### 第一步：启动 FunASR 服务（Docker）

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy

# 启动 FunASR 服务
docker compose -f docker/docker-compose.funasr.yml up -d

# 查看启动日志
docker compose -f docker/docker-compose.funasr.yml logs -f

# 等待模型下载和服务启动（首次启动可能需要5-10分钟）
# 看到 "Server started" 或类似信息即表示启动成功
```

### 第二步：安装 3D-Speaker 服务（Python）

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/python-services

# 运行安装脚本
bash setup.sh

# 或手动安装
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 第三步：启动 3D-Speaker 服务

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/python-services

# 激活虚拟环境
source venv/bin/activate

# 启动服务
uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002 --reload
```

### 第四步：验证服务

#### 验证 FunASR

```bash
# 健康检查
curl http://localhost:10095/api/health

# 预期返回：
# {"status": "ok", "version": "x.x.x", "models_loaded": true}
```

#### 验证 3D-Speaker

```bash
# 健康检查
curl http://localhost:5002/api/health

# 预期返回：
# {"status": "ok", "version": "1.0.0", "model_loaded": true, "registered_speakers": 0}

# 查看 API 文档
# 浏览器打开: http://localhost:5002/docs
```

## 📋 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| FunASR HTTP | 10095 | 文件转录 API |
| FunASR WebSocket | 10096 | 实时转录（可选） |
| 3D-Speaker | 5002 | 声纹识别 API |
| Node.js 后端 | 5001 | 主服务（待更新） |
| React 前端 | 3000 | 前端界面 |

## 🧪 测试服务

### 测试 FunASR 转录

```bash
# 准备测试音频（16kHz WAV）
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/test-resources/audio

# 发送转录请求
curl -X POST http://localhost:10095/api/v1/asr \
  -F "audio=@test.wav" \
  -F "format=wav" \
  -F "sample_rate=16000"
```

### 测试 3D-Speaker 声纹注册

```bash
# 注册测试声纹
curl -X POST http://localhost:5002/api/speaker/register \
  -F "name=测试用户" \
  -F "user_id=test_001" \
  -F "audio=@test.wav"

# 查看已注册声纹
curl http://localhost:5002/api/speaker/list
```

## ⚙️ 配置说明

### FunASR 配置

配置文件：`docker/docker-compose.funasr.yml`

关键配置：
- **DEVICE**: `cpu`（本机无GPU）
- **ncpu**: 4（可根据CPU核心数调整）
- **内存限制**: 4GB（可根据实际内存调整）

### 3D-Speaker 配置

配置文件：`backend/python-services/.env`

关键配置：
```bash
SPEAKER_DEVICE=cpu  # CPU 模式
SPEAKER_PORT=5002
SPEAKER_SIMILARITY_THRESHOLD=0.75  # 相似度阈值
```

## 🐛 常见问题

### Q1: FunASR 容器启动失败

```bash
# 检查端口占用
lsof -i :10095
lsof -i :10096

# 如果端口被占用，停止占用进程或修改端口配置
```

### Q2: FunASR 模型下载缓慢

```bash
# 使用国内镜像（如果需要）
export HF_ENDPOINT=https://hf-mirror.com

# 或手动下载模型后挂载到容器
```

### Q3: 3D-Speaker 安装失败

```bash
# 检查 Python 版本（需要 3.8+）
python3 --version

# 升级 pip
pip install --upgrade pip

# 单独安装可能有问题的包
pip install torch==2.0.1 --index-url https://download.pytorch.org/whl/cpu
pip install torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu
```

### Q4: CPU 占用过高

```bash
# 调整 FunASR 的 CPU 核心数
# 编辑 docker/docker-compose.funasr.yml，修改 --ncpu 参数

# 限制 3D-Speaker 的并发请求
# 编辑 .env，设置 SPEAKER_WORKERS=1
```

## 📝 下一步

完成服务验证后，继续进行**阶段二：服务适配**：

1. 开发 Node.js 客户端连接 FunASR
2. 开发 Node.js 客户端连接 3D-Speaker
3. 修改现有服务添加服务选择器
4. 更新 WebSocket 处理器
5. 更新环境变量配置

## 🔗 相关文档

- [详细规划文档](./plan/funasr-3dspeaker-migration.md)
- [FunASR 部署文档](./docker/funasr/README.md)
- [3D-Speaker 服务文档](./backend/python-services/README.md)

## 💡 提示

- **首次启动**：FunASR 需要下载模型（约2-3GB），请耐心等待
- **性能优化**：如果性能不足，可以考虑使用更小的模型
- **日志查看**：
  - FunASR: `docker logs funasr-service`
  - 3D-Speaker: `tail -f backend/python-services/logs/speaker_service.log`
