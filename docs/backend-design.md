# 后端技术方案设计

## 🎯 技术栈选择

### 核心框架
- **Node.js 20+** - 高性能JavaScript运行时
- **Express 4** - 轻量级Web应用框架
- **TypeScript 5** - 类型安全的JavaScript超集

### 实时通信
- **Socket.IO** - WebSocket实时通信框架
- **Redis Adapter** - 多实例Socket.IO适配器

### 音频处理
- **FFmpeg** - 音频格式转换和处理
- **node-ffmpeg** - FFmpeg Node.js封装
- **WebAssembly** - 客户端音频处理

### 数据库和缓存
- **MongoDB 7.0** - 文档型数据库，灵活的数据结构
- **Redis 7.2** - 内存数据库，缓存和会话存储
- **Mongoose** - MongoDB ODM工具

### 消息队列
- **Bull Queue** - 基于Redis的任务队列
- **Agenda** - 定时任务调度

## 🏗️ 项目架构

### 目录结构
```
backend/
├── src/
│   ├── controllers/           # 控制器层
│   │   ├── meetingController.ts
│   │   ├── transcriptionController.ts
│   │   ├── voiceprintController.ts
│   │   ├── aiController.ts
│   │   ├── emailController.ts
│   │   └── uploadController.ts
│   ├── services/              # 业务逻辑层
│   │   ├── meetingService.ts
│   │   ├── speechRecognition.ts
│   │   ├── voiceprintService.ts
│   │   ├── llmService.ts
│   │   ├── emailService.ts
│   │   ├── audioProcessor.ts
│   │   └── fileStorage.ts
│   ├── models/                # 数据模型层
│   │   ├── Meeting.ts
│   │   ├── Transcription.ts
│   │   ├── Participant.ts
│   │   ├── Voiceprint.ts
│   │   ├── MeetingMinutes.ts
│   │   └── AIConversation.ts
│   ├── middleware/            # 中间件
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── rateLimit.ts
│   │   ├── errorHandler.ts
│   │   ├── upload.ts
│   │   └── cors.ts
│   ├── websocket/             # WebSocket处理
│   │   ├── socketHandler.ts
│   │   ├── meetingSocket.ts
│   │   ├── transcriptionSocket.ts
│   │   └── voiceprintSocket.ts
│   ├── routes/                # 路由定义
│   │   ├── index.ts
│   │   ├── meetings.ts
│   │   ├── transcriptions.ts
│   │   ├── voiceprints.ts
│   │   ├── ai.ts
│   │   └── emails.ts
│   ├── utils/                 # 工具函数
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── crypto.ts
│   │   ├── dateUtils.ts
│   │   └── validation.ts
│   ├── types/                 # 类型定义
│   │   ├── meeting.ts
│   │   ├── transcription.ts
│   │   ├── voiceprint.ts
│   │   ├── api.ts
│   │   └── socket.ts
│   ├── jobs/                  # 后台任务
│   │   ├── audioProcessing.ts
│   │   ├── transcriptionProcessing.ts
│   │   ├── voiceprintTraining.ts
│   │   └── emailSending.ts
│   └── app.ts                 # 应用入口
├── uploads/                   # 文件上传目录
├── logs/                      # 日志文件
├── tests/                     # 测试文件
├── package.json
├── tsconfig.json
└── nodemon.json
```

## 🔧 核心服务设计

### 1. SpeechRecognitionService - 语音识别服务
```typescript
interface SpeechRecognitionService {
  // 实时语音识别
  startRealTimeRecognition(options: {
    meetingId: string;
    format: 'wav' | 'mp3' | 'webm';
    sampleRate: number;
    language: string;
  }): Promise<string>;

  // 批量语音识别
  processAudioFile(audioFile: Buffer, options: {
    format: string;
    sampleRate: number;
    language: string;
    enablePunctuation?: boolean;
    enableSpeakerDiarization?: boolean;
  }): Promise<TranscriptionResult>;

  // 停止识别
  stopRecognition(sessionId: string): Promise<void>;

  // 获取识别结果
  getTranscription(sessionId: string): Promise<TranscriptionSegment[]>;
}

interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
  duration: number;
}
```

### 2. VoiceprintService - 声纹识别服务
```typescript
interface VoiceprintService {
  // 注册声纹
  registerVoiceprint(participantId: string, audioSamples: Buffer[]): Promise<Voiceprint>;

  // 实时声纹识别
  identifySpeaker(audioSegment: Buffer, options?: {
    threshold?: number;
    topK?: number;
  }): Promise<VoiceprintMatch[]>;

  // 声纹聚类
  clusterVoiceprints(segments: AudioSegment[]): Promise<VoiceprintCluster[]>;

  // 训练声纹模型
  trainVoiceprintModel(voiceprintId: string, newSamples: Buffer[]): Promise<void>;

  // 声纹特征提取
  extractFeatures(audioBuffer: Buffer): Promise<number[]>;
}

interface VoiceprintMatch {
  voiceprintId: string;
  participantId: string;
  confidence: number;
  similarity: number;
}
```

### 3. LLMService - 大语言模型服务
```typescript
interface LLMService {
  // 生成会议纪要
  generateMeetingMinutes(transcripts: TranscriptionSegment[], options?: {
    language?: string;
    format?: 'markdown' | 'html' | 'json';
    includeActionItems?: boolean;
    includeDecisions?: boolean;
  }): Promise<MeetingMinutes>;

  // 优化纪要内容
  optimizeContent(originalMinutes: MeetingMinutes, userRequest: string): Promise<MeetingMinutes>;

  // AI对话
  chatWithContext(messages: ChatMessage[], context: MeetingContext): Promise<ChatResponse>;

  // 智能摘要
  generateSummary(content: string, maxLength?: number): Promise<string>;

  // 提取行动项
  extractActionItems(transcripts: TranscriptionSegment[]): Promise<ActionItem[]>;
}

interface MeetingMinutes {
  id: string;
  meetingId: string;
  title: string;
  date: Date;
  participants: string[];
  summary: string;
  topics: Topic[];
  actionItems: ActionItem[];
  decisions: Decision[];
  generatedAt: Date;
}
```

### 4. AudioProcessor - 音频处理服务
```typescript
interface AudioProcessor {
  // 音频格式转换
  convertFormat(inputBuffer: Buffer, inputFormat: string, outputFormat: string): Promise<Buffer>;

  // 音频降噪
  denoiseAudio(audioBuffer: Buffer): Promise<Buffer>;

  // 音频分段
  segmentAudio(audioBuffer: Buffer, segmentDuration: number): Promise<Buffer[]>;

  // 音频质量检测
  analyzeAudioQuality(audioBuffer: Buffer): Promise<AudioQuality>;

  // 实时音频流处理
  processAudioStream(stream: Readable, options: {
    sampleRate: number;
    channels: number;
    format: string;
  }): Transform;
}

interface AudioQuality {
  signalToNoiseRatio: number;
  volumeLevel: number;
  clarity: number;
  hasNoise: boolean;
  recommendations: string[];
}
```

## 🔌 WebSocket事件设计

### 1. 会议相关事件
```typescript
interface MeetingEvents {
  // 客户端 -> 服务端
  'join-meeting': { meetingId: string; userId: string };
  'leave-meeting': { meetingId: string; userId: string };
  'start-recording': { meetingId: string };
  'stop-recording': { meetingId: string };
  'pause-recording': { meetingId: string };
  'resume-recording': { meetingId: string };

  // 服务端 -> 客户端
  'meeting-joined': { meetingId: string; participants: Participant[] };
  'meeting-left': { meetingId: string; userId: string };
  'recording-started': { meetingId: string; timestamp: Date };
  'recording-stopped': { meetingId: string; duration: number };
  'meeting-status-changed': { meetingId: string; status: MeetingStatus };
  'participant-joined': { participant: Participant };
  'participant-left': { participantId: string };
}
```

### 2. 转录相关事件
```typescript
interface TranscriptionEvents {
  // 客户端 -> 服务端
  'audio-chunk': { meetingId: string; chunk: Buffer; timestamp: number };
  'transcription-correct': { segmentId: string; correctedText: string };

  // 服务端 -> 客户端
  'transcription-update': { segment: TranscriptionSegment };
  'transcription-complete': { segments: TranscriptionSegment[] };
  'speaker-identified': { segmentId: string; speakerId: string; confidence: number };
  'transcription-error': { error: string; segmentId?: string };
}
```

### 3. AI处理相关事件
```typescript
interface AIEvents {
  // 客户端 -> 服务端
  'generate-minutes': { meetingId: string; options?: GenerateOptions };
  'optimize-content': { minutesId: string; request: string };
  'ai-chat': { meetingId: string; message: string };

  // 服务端 -> 客户端
  'ai-thinking-start': { type: 'minutes' | 'optimization' | 'chat' };
  'ai-thinking-stop': { type: 'minutes' | 'optimization' | 'chat' };
  'minutes-generated': { minutes: MeetingMinutes };
  'content-optimized': { minutes: MeetingMinutes; changes: string[] };
  'ai-chat-response': { message: ChatMessage };
  'ai-progress': { stage: string; progress: number; message?: string };
}
```

## 🗄️ 数据库模型设计

### 1. Meeting模型
```typescript
interface MeetingDocument {
  _id: ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  participants: ObjectId[];
  status: 'scheduled' | 'in-progress' | 'processing' | 'completed';
  settings: {
    language: string;
    enableTranscription: boolean;
    enableVoiceprint: boolean;
    autoGenerateMinutes: boolean;
  };
  metadata: {
    duration?: number;
    audioFiles: string[];
    transcriptCount: number;
    participantCount: number;
  };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Transcription模型
```typescript
interface TranscriptionDocument {
  _id: ObjectId;
  meetingId: ObjectId;
  segmentId: string;
  speakerId: ObjectId;
  speakerName: string;
  content: string;
  originalContent: string;
  confidence: number;
  timestamp: Date;
  duration: number;
  audioSegment?: {
    file: string;
    startTime: number;
    endTime: number;
  };
  corrections: Array<{
    correctedAt: Date;
    correctedBy: ObjectId;
    originalText: string;
    correctedText: string;
  }>;
  isFinal: boolean;
  processingStatus: 'processing' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Voiceprint模型
```typescript
interface VoiceprintDocument {
  _id: ObjectId;
  participantId: ObjectId;
  name: string;
  email?: string;
  voiceFeatures: {
    embedding: number[];
    algorithm: string;
    version: string;
  };
  trainingSamples: Array<{
    file: string;
    duration: number;
    quality: number;
    recordedAt: Date;
  }>;
  accuracy: {
    overall: number;
    truePositive: number;
    falsePositive: number;
    lastUpdated: Date;
  };
  status: 'training' | 'active' | 'inactive';
  metadata: {
    gender?: string;
    age?: string;
    accent?: string;
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## 🔐 中间件设计

### 1. 认证中间件
```typescript
interface AuthMiddleware {
  verifyToken(req: Request, res: Response, next: NextFunction): void;
  generateToken(payload: any): string;
  refreshToken(refreshToken: string): Promise<string>;
  revokeToken(token: string): Promise<void>;
}

// 使用示例
app.use('/api/meetings', authenticateToken);
app.use('/api/voiceprints', authenticateToken);
```

### 2. 限流中间件
```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

// API限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100个请求
  message: 'Too many requests from this IP'
});

// 音频上传限流
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最多10个文件
  message: 'Upload rate limit exceeded'
});
```

### 3. 文件上传中间件
```typescript
interface UploadConfig {
  destination: string;
  filename: (req: Request, file: Express.Multer.File, cb: Function) => void;
  limits: {
    fileSize: number;
    files: number;
  };
  fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => void;
}

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/audio/',
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueName}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});
```

## ⚡ 性能优化策略

### 1. 缓存策略
```typescript
// Redis缓存配置
interface CacheConfig {
  meetings: {
    ttl: 3600; // 1小时
    prefix: 'meeting:';
  };
  transcriptions: {
    ttl: 1800; // 30分钟
    prefix: 'transcription:';
  };
  voiceprints: {
    ttl: 86400; // 24小时
    prefix: 'voiceprint:';
  };
  aiResults: {
    ttl: 7200; // 2小时
    prefix: 'ai:';
  };
}

// 缓存服务实现
class CacheService {
  async get<T>(key: string): Promise<T | null>;
  async set(key: string, value: any, ttl?: number): Promise<void>;
  async del(key: string): Promise<void>;
  async invalidatePattern(pattern: string): Promise<void>;
}
```

### 2. 数据库优化
```typescript
// MongoDB索引配置
const indexes = [
  // 会议索引
  { collection: 'meetings', index: { createdBy: 1, createdAt: -1 } },
  { collection: 'meetings', index: { status: 1, startTime: -1 } },

  // 转录索引
  { collection: 'transcriptions', index: { meetingId: 1, timestamp: 1 } },
  { collection: 'transcriptions', index: { speakerId: 1, timestamp: -1 } },

  // 声纹索引
  { collection: 'voiceprints', index: { participantId: 1 } },
  { collection: 'voiceprints', index: { 'voiceFeatures.embedding': '2dsphere' } }
];

// 连接池配置
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false
};
```

### 3. 音频处理优化
```typescript
// 音频处理队列
const audioProcessingQueue = new Bull('audio-processing', {
  redis: { port: 6379, host: 'redis' },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: 'exponential'
  }
});

// 批量处理优化
class AudioBatchProcessor {
  private batchSize = 10;
  private processingInterval = 5000; // 5秒

  async addToBatch(audioChunk: AudioChunk): Promise<void>;
  async processBatch(): Promise<ProcessedResult[]>;
  async flushBatch(): Promise<void>;
}
```

## 🔧 配置管理

### 1. 环境配置
```typescript
interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  database: {
    mongodb: {
      uri: string;
      options: any;
    };
    redis: {
      host: string;
      port: number;
      password?: string;
    };
  };
  services: {
    alibabaCloud: {
      accessKeyId: string;
      accessKeySecret: string;
      region: string;
    };
    deepseek: {
      apiKey: string;
      baseURL: string;
      model: string;
    };
    email: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  upload: {
    maxFileSize: number;
    allowedFormats: string[];
    storagePath: string;
  };
  websocket: {
    cors: {
      origin: string[];
      credentials: boolean;
    };
    pingTimeout: number;
    pingInterval: number;
  };
}
```

### 2. 日志配置
```typescript
// Winston日志配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'meeting-agent-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 🧪 测试策略

### 1. 单元测试
```typescript
// Jest测试配置
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 2. 集成测试
```typescript
// API集成测试示例
describe('Meeting API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  describe('POST /api/meetings', () => {
    it('should create a new meeting', async () => {
      const meetingData = {
        title: 'Test Meeting',
        description: 'Test Description'
      };

      const response = await request(app)
        .post('/api/meetings')
        .set('Authorization', 'Bearer test-token')
        .send(meetingData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe(meetingData.title);
    });
  });
});
```

## 🚀 部署和监控

### 1. 健康检查
```typescript
// 健康检查端点
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      externalServices: await checkExternalServices()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### 2. 监控和指标
```typescript
// Prometheus指标
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeMeetings = new promClient.Gauge({
  name: 'active_meetings_total',
  help: 'Number of active meetings'
});

const transcriptionQueueSize = new promClient.Gauge({
  name: 'transcription_queue_size',
  help: 'Size of transcription processing queue'
});
```

### 3. 错误处理
```typescript
// 全局错误处理中间件
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : error.message;

  res.status(status).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    }
  });
};
```