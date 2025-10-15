# API接口设计

## 🎯 设计原则

- **简洁优先** - 最少接口，专注核心功能
- **RESTful风格** - 标准HTTP方法和状态码
- **实时通信** - WebSocket补充复杂交互
- **统一响应** - 标准化JSON格式

## 📡 RESTful API

### 基础配置
```
Base URL: http://localhost:5000/api
Content-Type: application/json
Authorization: Bearer {token}
```

### 响应格式
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}
```

## 🔗 核心接口

### 1. 会议管理
```typescript
// 创建会议
POST /meetings
{
  title: string;
  description?: string;
  settings: {
    language: string;
    enableTranscription: boolean;
    enableVoiceprint: boolean;
  };
}

// 获取会议列表
GET /meetings?status=active&page=1&limit=10

// 获取会议详情
GET /meetings/:meetingId

// 更新会议
PUT /meetings/:meetingId
{
  title?: string;
  description?: string;
  status?: string;
}

// 删除会议
DELETE /meetings/:meetingId
```

### 2. 实时转录
```typescript
// 开始录音
POST /meetings/:meetingId/recording/start

// 停止录音
POST /meetings/:meetingId/recording/stop

// 上传音频文件
POST /meetings/:meetingId/upload-audio
Content-Type: multipart/form-data
{
  audio: File;
  format: string;
}

// 获取转录结果
GET /meetings/:meetingId/transcriptions
```

### 3. 声纹管理
```typescript
// 注册声纹
POST /voiceprints/register
{
  participantId: string;
  name: string;
  email: string;
  audioData: string; // base64编码
}

// 识别发言人
POST /voiceprints/identify
{
  audioData: string;
  meetingId: string;
}

// 获取声纹列表
GET /voiceprints

// 训练声纹模型
POST /voiceprints/:voiceprintId/train
{
  audioSamples: string[];
}
```

### 4. AI处理
```typescript
// 生成会议纪要
POST /meetings/:meetingId/minutes/generate
{
  options?: {
    includeActionItems: boolean;
    includeDecisions: boolean;
    language: string;
  };
}

// 优化纪要内容
POST /meetings/:meetingId/optimize
{
  minutesId: string;
  request: string;
}

// AI对话
POST /meetings/:meetingId/chat
{
  message: string;
  context?: string;
}
```

### 5. 邮件发送
```typescript
// 生成邮件内容
POST /meetings/:meetingId/email/preview
{
  minutesId: string;
  recipients?: string[];
}

// 发送邮件
POST /meetings/:meetingId/email/send
{
  minutesId: string;
  recipients: string[];
  subject?: string;
  body?: string;
}

// 获取邮件历史
GET /meetings/:meetingId/emails
```

## 🔌 WebSocket事件

### 连接管理
```typescript
// 连接建立
socket.emit('join-meeting', { meetingId: string, userId: string });
socket.emit('leave-meeting', { meetingId: string, userId: string });

// 会议状态
socket.on('meeting-status-changed', { meetingId: string, status: string });
socket.on('participant-joined', { participant: Participant });
socket.on('participant-left', { participantId: string });
```

### 实时转录
```typescript
// 音频数据传输
socket.emit('audio-chunk', {
  meetingId: string;
  chunk: Buffer;
  timestamp: number
});

// 转录结果推送
socket.on('transcription-update', {
  segment: TranscriptionSegment
});

socket.on('speaker-identified', {
  segmentId: string;
  speakerId: string;
  confidence: number
});
```

### AI处理状态
```typescript
// AI处理事件
socket.emit('generate-minutes', { meetingId: string, options?: object });
socket.emit('ai-chat', { meetingId: string, message: string });

// AI状态推送
socket.on('ai-thinking-start', { type: 'minutes' | 'optimization' | 'chat' });
socket.on('ai-thinking-stop', { type: string });
socket.on('ai-progress', { stage: string, progress: number, message?: string });

// 结果推送
socket.on('minutes-generated', { minutes: MeetingMinutes });
socket.on('content-optimized', { minutes: MeetingMinutes, changes: string[] });
socket.on('ai-chat-response', { message: ChatMessage });
```

## 📊 数据模型

### 请求/响应类型
```typescript
interface Meeting {
  _id: string;
  title: string;
  description?: string;
  status: 'idle' | 'recording' | 'processing' | 'completed';
  startTime: string;
  endTime?: string;
  participants: Participant[];
  settings: MeetingSettings;
  createdAt: string;
  updatedAt: string;
}

interface TranscriptionSegment {
  id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  content: string;
  confidence: number;
  timestamp: string;
  duration: number;
  isFinal: boolean;
}

interface Voiceprint {
  _id: string;
  participantId: string;
  name: string;
  email: string;
  voiceFeatures: {
    embedding: number[];
    status: string;
    accuracy: number;
  };
  createdAt: string;
}

interface MeetingMinutes {
  _id: string;
  meetingId: string;
  title: string;
  summary: string;
  topics: Topic[];
  actionItems: ActionItem[];
  participants: string[];
  generatedAt: string;
  status: 'draft' | 'final' | 'sent';
}
```

## 🔒 认证授权

### JWT Token
```typescript
// 登录获取token
POST /auth/login
{
  email: string;
  password: string;
}

// 刷新token
POST /auth/refresh
{
  refreshToken: string;
}

// Token格式
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 权限控制
```typescript
// 会议权限
- 会议创建者：完全控制
- 会议参与者：查看和基础操作
- 公开会议：只读访问

// 声纹权限
- 本人：完全控制
- 管理员：完全控制
- 其他人：只读访问
```

## ⚡ 性能优化

### 请求优化
```typescript
// 分页查询
GET /meetings?page=1&limit=20&sort=createdAt&order=desc

// 字段选择
GET /meetings/:meetingId?fields=title,status,startTime

// 批量操作
POST /meetings/batch
{
  action: 'update';
  meetingIds: string[];
  data: object;
}
```

### 缓存策略
```typescript
// 缓存控制
Cache-Control: public, max-age=300
ETag: "abc123"

// 条件请求
If-None-Match: "abc123"
If-Modified-Since: Wed, 21 Oct 2023 07:28:00 GMT
```

## 🛡️ 错误处理

### 标准错误响应
```typescript
// 客户端错误 (4xx)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { "field": "email", "message": "Invalid format" }
  }
}

// 服务端错误 (5xx)
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Service temporarily unavailable"
  }
}
```

### 错误代码规范
```
AUTH_001 - 未授权访问
AUTH_002 - Token已过期
VALIDATION_001 - 输入验证失败
RESOURCE_001 - 资源不存在
SERVICE_001 - 外部服务不可用
RATE_LIMIT_001 - 请求频率超限
```

## 📝 API文档

### Swagger配置
```yaml
openapi: 3.0.0
info:
  title: 智能会议纪要API
  version: 1.0.0
  description: AI-powered meeting minutes system
servers:
  - url: http://localhost:5000/api
    description: 开发环境
```

### 测试用例
```typescript
// 创建会议测试
describe('POST /meetings', () => {
  it('should create a new meeting', async () => {
    const response = await request(app)
      .post('/api/meetings')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: '测试会议',
        settings: { language: 'zh-CN' }
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('测试会议');
  });
});
```

这个API设计确保了接口简洁明了，易于理解和实现，同时支持实时通信和复杂业务场景。