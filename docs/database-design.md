# 数据库设计方案

## 🗄️ 数据库架构

### 核心存储
- **MongoDB 7.0** - 主数据库，存储会议、转录、用户数据
- **Redis 7.2** - 缓存和会话存储

### 设计原则
- **极简模型** - 最少字段，专注核心功能
- **高效查询** - 关键索引优化
- **灵活扩展** - JSON字段支持业务变化

## 📊 核心数据模型

### 1. Meeting - 会议
```typescript
{
  _id: ObjectId,
  title: string,              // 会议标题
  status: string,             // idle|recording|processing|completed
  startTime: Date,           // 开始时间
  endTime?: Date,            // 结束时间
  participants: ObjectId[],  // 参会者ID列表
  settings: {
    language: string,        // 语言 zh-CN|en-US
    enableTranscription: boolean,
    enableVoiceprint: boolean
  },
  audioFiles: string[],      // 音频文件路径
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Transcription - 转录片段
```typescript
{
  _id: ObjectId,
  meetingId: ObjectId,       // 关联会议
  speakerId: ObjectId,       // 发言人
  speakerName: string,       // 发言人名称
  content: string,           // 转录内容
  confidence: number,        // 置信度
  timestamp: Date,          // 发言时间
  duration: number,         // 时长(秒)
  isFinal: boolean,         // 是否最终结果
  corrections: [{           // 修正记录
    correctedAt: Date,
    originalText: string,
    correctedText: string
  }],
  createdAt: Date
}
```

### 3. Participant - 参会者
```typescript
{
  _id: ObjectId,
  name: string,             // 姓名
  email: string,            // 邮箱
  voiceprint: {
    embedding: number[],    // 声纹特征向量
    status: string,         // training|active|inactive
    accuracy: number,       // 识别准确率
    samples: number,        // 训练样本数
    lastTrained: Date
  },
  metadata: {
    department?: string,
    role?: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 4. MeetingMinutes - 会议纪要
```typescript
{
  _id: ObjectId,
  meetingId: ObjectId,      // 关联会议
  title: string,           // 纪要标题
  summary: string,         // 会议摘要
  topics: [{               // 讨论主题
    title: string,
    summary: string,
    decisions: string[]
  }],
  actionItems: [{          // 行动项
    task: string,
    assignee: string,
    dueDate: Date,
    priority: string
  }],
  participants: string[],   // 参会人列表
  generatedAt: Date,       // 生成时间
  version: number,         // 版本号
  status: string,          // draft|final|sent
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 MongoDB 索引策略

### 复合索引
```javascript
// 会议查询优化
db.meetings.createIndex({ "status": 1, "startTime": -1 })
db.meetings.createIndex({ "createdBy": 1, "createdAt": -1 })

// 转录查询优化
db.transcriptions.createIndex({ "meetingId": 1, "timestamp": 1 })
db.transcriptions.createIndex({ "speakerId": 1, "timestamp": -1 })

// 参会者查询优化
db.participants.createIndex({ "voiceprint.status": 1 })
db.participants.createIndex({ "email": 1 }, { unique: true })
```

## ⚡ Redis 缓存设计

### 缓存键规范
```
meeting:active:{meetingId}        # 活跃会议状态 (TTL: 2h)
transcription:realtime:{meetingId} # 实时转录片段 (TTL: 30m)
voiceprint:match:{speakerId}       # 声纹匹配结果 (TTL: 1h)
ai:processing:{meetingId}          # AI处理状态 (TTL: 15m)
```

### 数据结构
```redis
# 活跃会议状态
HSET meeting:active:12345 status recording startTime 1734123456

# 实时转录队列
LPUSH transcription:realtime:12345 '{"speakerId":"001","content":"..."}'

# 声纹匹配缓存
SET voiceprint:match:001 '{"participantId":"user123","confidence":0.95}'

# AI处理状态
SET ai:processing:12345 '{"stage":"thinking","progress":30}'
```

## 📈 性能优化

### 查询优化
- **分页查询** - 使用skip和limit
- **字段选择** - 投影减少数据传输
- **聚合管道** - 复杂查询优化

### 存储优化
- **GridFS** - 大文件存储
- **TTL索引** - 自动过期清理
- **数据压缩** - 减少存储空间

## 🔧 部署配置

### 连接配置
```javascript
const mongoOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0
};

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
};
```

### 监控指标
- 连接池状态
- 查询响应时间
- 内存使用率
- 缓存命中率

## 🧪 测试数据

### 种子数据脚本
```javascript
// 创建测试参会者
const participants = [
  { name: "张三", email: "zhangsan@company.com" },
  { name: "李四", email: "lisi@company.com" },
  { name: "王五", email: "wangwu@company.com" }
];

// 创建测试会议
const meetings = [
  { title: "产品规划会议", status: "completed" },
  { title: "技术评审会议", status: "in-progress" }
];
```

## 📋 数据迁移

### 版本控制
```javascript
// 数据库版本记录
{
  _id: ObjectId,
  version: string,        // v1.0.0
  migrations: string[],   // 已执行的迁移
  appliedAt: Date
}
```

### 迁移脚本
```javascript
// 示例：添加新字段
db.meetings.updateMany(
  { metadata: { $exists: false } },
  { $set: { metadata: { duration: 0, participantCount: 0 } } }
);
```

这个设计确保了数据模型简洁高效，专注于核心业务功能，同时具备良好的扩展性和性能表现。