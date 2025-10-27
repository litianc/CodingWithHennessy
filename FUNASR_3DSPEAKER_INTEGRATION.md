# FunASR 和 3D-Speaker 集成文档

## 概述

本文档描述了智能会议纪要系统中 FunASR（语音识别）和 3D-Speaker（声纹识别）服务的集成实现。

## 系统架构

### 服务组件

```
┌─────────────────┐
│  前端 (React)   │
│  Port: 3000     │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         ▼
┌─────────────────┐
│ 后端 (Node.js)  │
│  Port: 5001     │
└────────┬────────┘
         │
         ├─────────────────┬──────────────────┐
         │                 │                  │
         ▼                 ▼                  ▼
┌────────────────┐  ┌─────────────┐  ┌──────────────┐
│  FunASR        │  │ 3D-Speaker  │  │  DeepSeek    │
│  Docker:10095  │  │ Python:5002 │  │  LLM API     │
│  (语音识别)    │  │ (声纹识别)  │  │  (AI处理)    │
└────────────────┘  └─────────────┘  └──────────────┘
```

## 1. Python 声纹服务 (3D-Speaker)

### 1.1 服务信息

- **端口**: 5002
- **技术栈**: FastAPI + ModelScope + 3D-Speaker
- **路径**: `backend/python-services/speaker_service/`

### 1.2 API 端点

#### 健康检查
```bash
GET http://localhost:5002/api/health
```
响应:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "model_loaded": true,
  "registered_speakers": 8
}
```

#### 注册声纹
```bash
POST http://localhost:5002/api/speaker/register
Content-Type: multipart/form-data

Fields:
- name: 说话人姓名
- audio: 音频文件 (wav/mp3)
- user_id: 用户ID (可选)
- email: 邮箱 (可选)
```

#### 识别说话人
```bash
POST http://localhost:5002/api/speaker/recognize
Content-Type: multipart/form-data

Fields:
- audio: 音频文件
- top_k: 返回前K个匹配结果 (默认5)
```

#### 说话人分割 (Diarization)
```bash
POST http://localhost:5002/api/speaker/diarization
Content-Type: multipart/form-data

Fields:
- audio: 音频文件
- num_speakers: 说话人数量 (可选，自动检测)
```

#### 获取说话人列表
```bash
GET http://localhost:5002/api/speaker/list
```

#### 删除声纹
```bash
DELETE http://localhost:5002/api/speaker/{speaker_id}
```

### 1.3 配置参数

文件: `backend/python-services/speaker_service/config.py`

```python
HOST: "0.0.0.0"
PORT: 5002
SPEAKER_MODEL: "damo/speech_eres2net_base_200k_sv_zh-cn_16k-common"
DEVICE: "cpu"  # 或 "cuda"
SIMILARITY_THRESHOLD: 0.75
SAMPLE_RATE: 16000
```

### 1.4 启动服务

```bash
cd backend/python-services
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002
```

## 2. FunASR 服务 (语音识别)

### 2.1 服务信息

- **HTTP端口**: 10095
- **WebSocket端口**: 10096
- **部署方式**: Docker容器
- **配置文件**: `docker/docker-compose.funasr.yml`

### 2.2 Docker 部署

```bash
cd docker
docker compose -f docker-compose.funasr.yml up -d
```

### 2.3 服务状态

⚠️ **注意**: FunASR Docker 容器目前存在启动问题，需要进一步配置。

**临时方案**: 系统可以在 Mock 模式下运行，用于演示和测试。

## 3. 后端 TypeScript 服务集成

### 3.1 服务封装

#### SpeakerRecognitionService
文件: `backend/src/services/speakerRecognitionService.ts`

```typescript
// 连接到 Python 声纹服务
const speakerRecognitionService = new SpeakerRecognitionService({
  serviceUrl: 'http://localhost:5002',
  timeout: 15000,
  similarityThreshold: 0.75
})

// 使用示例
await speakerRecognitionService.registerSpeaker(userId, name, audioPath)
const matches = await speakerRecognitionService.recognizeSpeaker(audioPath)
const segments = await speakerRecognitionService.diarization(audioPath)
```

#### FunASRService
文件: `backend/src/services/funasrService.ts`

```typescript
// 连接到 FunASR 服务
const funasrService = new FunASRService({
  serviceUrl: 'http://localhost:10095',
  wsUrl: 'ws://localhost:10096',
  timeout: 30000
})

// 文件转录
const results = await funasrService.recognizeFromFile(audioPath, {
  language: 'zh-cn',
  enablePunctuation: true
})

// 实时转录
const session = await funasrService.createRealTimeSession()
await session.connect()
session.on('data', (event) => {
  console.log('转录结果:', event.result.text)
})
```

#### MultiSpeakerTranscriptionService
文件: `backend/src/services/multiSpeakerTranscriptionService.ts`

协调 FunASR 和 3D-Speaker，实现多说话人转录：

```typescript
const result = await multiSpeakerTranscriptionService.transcribe(audioPath, {
  language: 'zh-cn',
  enablePunctuation: true,
  userId: userId
})

// 返回结果包含:
// - segments: 带说话人标注的转录片段
// - speakers: 说话人统计信息
// - speakerCount: 说话人数量
// - unknownSpeakerCount: 未识别说话人数量
```

### 3.2 转录流程

1. **说话人分割**: 使用 3D-Speaker 的 diarization API
2. **声纹识别**: 对每个说话人片段进行声纹匹配
3. **语音识别**: 使用 FunASR 转录整段音频
4. **结果合并**: 将转录文本与说话人信息关联
5. **统计计算**: 生成说话人发言统计

## 4. 前端集成

### 4.1 实时转录组件

文件: `frontend/src/components/meeting/RealTimeTranscription/index.tsx`

功能特性:
- 实时显示转录内容
- 显示说话人信息和头像
- 置信度可视化
- 内容搜索和筛选
- 说话人筛选
- 导出功能

WebSocket 事件:
```typescript
socket.on('transcription-started', () => {})
socket.on('transcription-segment', (data) => {})
socket.on('transcription-completed', (data) => {})
socket.on('transcription-error', (error) => {})
```

### 4.2 说话人统计组件

文件: `frontend/src/components/meeting/SpeakerStatistics/index.tsx`

功能特性:
- 概览统计卡片（总人数、转录片段、已识别人数）
- 说话人详情卡片
  - 发言时长
  - 发言片段数
  - 平均置信度
  - 发言占比
- 发言时间线视图
- 响应式设计
- 深色模式支持

### 4.3 会议详情页集成

文件: `frontend/src/pages/MeetingDetailPage/index.tsx`

页面结构:
```tsx
<Tabs>
  <TabPane tab="实时转录">
    <RealTimeTranscription />
  </TabPane>
  <TabPane tab="说话人统计">
    <SpeakerStatistics
      speakers={meeting.speakers}
      transcriptions={meeting.transcriptions}
    />
  </TabPane>
  <TabPane tab="会议纪要">
    <MeetingMinutes />
  </TabPane>
  <TabPane tab="AI 助手">
    <AIChat />
  </TabPane>
</Tabs>
```

## 5. 数据模型

### 5.1 转录片段 (TranscriptionSegment)

```typescript
interface TranscriptionSegment {
  id: string
  speakerId: string           // 说话人ID
  speakerName: string         // 说话人姓名
  isUnknown: boolean         // 是否未识别
  content: string            // 转录文本
  timestamp: Date            // 时间戳
  confidence: number         // 置信度 (0-1)
  startTime: number          // 开始时间 (ms)
  endTime: number            // 结束时间 (ms)
  words?: Array<{            // 词级时间戳
    word: string
    startTime: number
    endTime: number
    confidence?: number
  }>
}
```

### 5.2 说话人统计 (SpeakerStatistics)

```typescript
interface SpeakerStats {
  speakerId: string          // 说话人ID
  name: string              // 姓名
  department?: string       // 部门
  isKnown: boolean         // 是否已识别
  isUnknown: boolean       // 是否未识别
  voiceprintId?: string    // 声纹ID
  segmentCount: number     // 发言片段数
  totalDuration: number    // 总发言时长 (ms)
  percentage: number       // 发言占比 (%)
  avgConfidence: number    // 平均置信度 (0-1)
}
```

## 6. 测试验证

### 6.1 服务健康检查

```bash
# Python 声纹服务
curl http://localhost:5002/api/health

# 后端 TypeScript 服务
# (需要根据实际路由配置)

# 前端服务
curl http://localhost:3000
```

### 6.2 已注册的测试说话人

当前系统已注册 8 个声纹:
- LXY (user-001)
- Cyan (user-002)
- Yuhe (user-003)
- Hongbo (user-004)
- 等...

### 6.3 测试音频文件

测试音频存放路径:
```
backend/test-resources/audio/
```

## 7. 开发调试

### 7.1 日志配置

- **前端**: 浏览器控制台
- **后端**: `backend/logs/`
- **Python服务**: `backend/python-services/logs/`

日志保留策略: 删除 3 天前的日志

### 7.2 常见问题

#### 1. FunASR 容器不断重启
**原因**: 容器缺少启动命令或模型文件
**解决**:
- 检查 docker-compose.funasr.yml 配置
- 查看容器日志: `docker logs funasr-service`
- 临时使用 Mock 模式

#### 2. Python 服务模型加载失败
**原因**: ModelScope 模型未下载或网络问题
**解决**:
- 检查 `~/.cache/modelscope/hub/` 目录
- 使用 Mock 模式: 服务会自动降级到 Mock 模式

#### 3. 端口冲突
**解决**:
```bash
# 检查端口占用
lsof -ti:5002  # Python 服务
lsof -ti:5001  # 后端服务
lsof -ti:3000  # 前端服务

# 杀死进程
kill -9 <PID>
```

## 8. 部署建议

### 8.1 生产环境配置

1. **启用 GPU 加速** (如果可用):
   ```python
   DEVICE: "cuda"
   ```

2. **调整性能参数**:
   ```yaml
   # docker-compose.funasr.yml
   deploy:
     resources:
       limits:
         cpus: '4'
         memory: 4G
   ```

3. **配置环境变量**:
   ```bash
   SPEAKER_SERVICE_URL=http://localhost:5002
   FUNASR_SERVICE_URL=http://localhost:10095
   SPEAKER_SIMILARITY_THRESHOLD=0.75
   ```

### 8.2 安全建议

- 为 Python 服务添加认证中间件
- 限制上传音频文件大小
- 定期清理临时文件
- 使用 HTTPS
- 实施 CORS 策略

## 9. 未来改进

1. **FunASR 服务稳定性**: 解决 Docker 启动问题
2. **声纹识别精度**: 优化相似度阈值和模型参数
3. **实时性能**: 优化 WebSocket 连接和音频流处理
4. **可扩展性**: 支持分布式部署和负载均衡
5. **错误处理**: 完善异常处理和降级策略

## 10. 参考文档

- [FunASR 官方文档](https://github.com/alibaba-damo-academy/FunASR)
- [3D-Speaker 官方文档](https://github.com/modelscope/3D-Speaker)
- [ModelScope 文档](https://www.modelscope.cn/)

---

**最后更新**: 2025-10-22
**版本**: v1.0.0
