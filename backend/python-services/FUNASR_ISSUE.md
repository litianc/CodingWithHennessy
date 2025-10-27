# FunASR Docker 部署问题说明

## 当前状态

FunASR Docker 镜像 (`funasr-runtime-sdk-cpu-0.4.5`) 在非交互模式下无法正常启动。

## 问题分析

1. **镜像特性**: FunASR Runtime SDK 镜像设计为交互式容器，默认命令是 `/bin/bash`
2. **启动方式**: 官方文档推荐使用 `docker run -it` 交互模式启动，然后在容器内手动执行服务脚本
3. **Docker Compose 限制**: Docker Compose 难以直接支持需要交互式启动的服务

## 解决方案

### 方案一：使用 Mock 模式（推荐用于开发测试）

由于 FunASR Docker 配置复杂，建议在开发测试阶段使用 Mock 模式：

1. **启用 Mock 模式**:
   ```bash
   # 在 .env 文件中设置
   USE_MOCK_SPEECH_SERVICE=true
   SPEECH_SERVICE_PROVIDER=funasr
   ```

2. **优点**:
   - 无需配置复杂的 Docker 服务
   - 快速开发测试
   - 不依赖网络和模型下载

3. **测试流程**:
   ```bash
   # 测试 3D-Speaker 服务（已正常运行）
   curl http://localhost:5002/api/health

   # 使用 Mock 模式的 FunASR
   # 后端会返回模拟的转写结果
   ```

### 方案二：手动启动 FunASR 容器（适合熟悉 Docker 的用户）

如果确实需要使用 FunASR Docker 服务，可以手动启动：

```bash
# 1. 启动容器（交互模式）
docker run -it --name funasr-service \
  -p 10095:10095 \
  -p 10096:10096 \
  -v $(pwd)/docker/funasr/models:/workspace/models \
  registry.cn-hangzhou.aliyuncs.com/funasr_repo/funasr:funasr-runtime-sdk-cpu-0.4.5 \
  /bin/bash

# 2. 在容器内手动启动服务
cd /workspace/FunASR/runtime
bash run_server_2pass.sh \
  --download-model-dir /workspace/models \
  --model-dir damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-onnx \
  --online-model-dir damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online-onnx \
  --vad-dir damo/speech_fsmn_vad_zh-cn-16k-common-onnx \
  --punc-dir damo/punc_ct-transformer_zh-cn-common-vad_realtime-vocab272727-onnx \
  --port 10095 \
  --certfile 0 \
  --itn-dir thuduj12/fst_itn_zh
```

### 方案三：使用阿里云服务（生产环境推荐）

保留阿里云语音识别服务作为备选方案：

```bash
# 在 .env 文件中切换
SPEECH_SERVICE_PROVIDER=aliyun
ALIBABA_CLOUD_APP_KEY=your-app-key
```

### 方案四：等待官方改进

FunASR 团队正在改进 Docker 镜像的易用性，未来版本可能会提供更简单的启动方式。

## 当前建议

**对于测试阶段，强烈建议使用方案一（Mock 模式）**：

1. 3D-Speaker 服务已成功部署并运行 ✅
2. FunASR 使用 Mock 模式进行功能测试 ✅
3. 所有客户端代码（funasrService.ts）已完成 ✅
4. 待真正需要 FunASR 时，再考虑方案二或方案三

## 验证步骤

### 1. 验证 3D-Speaker 服务

```bash
cd backend/python-services
source venv/bin/activate
curl http://localhost:5002/api/health
```

预期输出：
```json
{
  "status": "ok",
  "version": "1.0.0",
  "model_loaded": false,
  "registered_speakers": 0
}
```

### 2. 测试集成（Mock 模式）

```bash
# 设置环境变量
export USE_MOCK_SPEECH_SERVICE=true
export SPEECH_SERVICE_PROVIDER=funasr

# 运行测试
python3 test_services.py
```

## 技术背景

FunASR Runtime SDK 是一个复杂的语音识别服务框架：
- 需要下载多个大型模型文件（数GB）
- 需要在容器内部执行启动脚本
- CPU 模式下性能较慢
- 更适合生产环境的专门部署

对于开发测试，Mock 模式已经足够验证整个系统的架构和集成。

## 总结

| 方案 | 复杂度 | 性能 | 推荐场景 |
|------|--------|------|----------|
| Mock 模式 | ⭐ | N/A | 开发测试（推荐） |
| 手动 Docker | ⭐⭐⭐ | ⭐⭐ | 本地完整测试 |
| 阿里云服务 | ⭐⭐ | ⭐⭐⭐⭐⭐ | 生产环境（推荐） |

**当前状态**: 3D-Speaker 服务正常运行，建议使用 Mock 模式完成开发测试。
