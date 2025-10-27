# 字段映射指南

## 用户ID字段完整映射关系

### 概览表

| 层级 | 字段名 | 类型 | 必填 | 用途 | 示例值 |
|------|--------|------|------|------|--------|
| **前端** | `user_id` | `string?` | 否 | 传递给3D-Speaker的用户标识 | `"user_123"` |
| **MongoDB后端** | `ownerId` | `ObjectId` | 是 | 声纹所有者的MongoDB用户ID | `68fb2fc6efab2e7f39f54581` |
| **3D-Speaker服务** | `user_id` | `string?` | 否 | Python服务中的用户标识（可选） | `"user_123"` 或 `ObjectId.toString()` |

---

## 详细字段说明

### 1. 前端 (frontend/src/services/voiceprintService.ts)

```typescript
export interface Voiceprint {
  speaker_id: string      // 3D-Speaker的speaker_id（MD5格式）
  name: string
  user_id?: string        // ⚠️ 这是传递给3D-Speaker的用户标识（可选）
  email?: string
  created_at: string
  sample_count: number
}

export interface VoiceprintRegistrationData {
  name: string
  user_id?: string        // ⚠️ 可选字段，用于3D-Speaker
  email?: string
  audio: File
}
```

**用途**：
- `user_id` 是一个**可选**的业务字段
- 用于在3D-Speaker服务中标记声纹属于哪个用户
- 前端可以传递，也可以不传递

---

### 2. MongoDB后端 (backend/src/models/Voiceprint.ts)

```typescript
export interface IVoiceprint extends Document {
  _id: string                        // MongoDB自动生成的文档ID
  speakerId: string                  // 3D-Speaker的speaker_id（MD5格式）
  name: string
  department?: string
  position?: string
  email?: string
  phone?: string

  // 声纹数据
  embedding: IEmbedding
  samples: IAudioSample[]
  sampleCount: number
  stats: IVoiceprintStats

  // 访问控制 ⚠️ 关键字段
  ownerId: mongoose.Types.ObjectId   // 声纹所有者的用户ID（必填）
  isPublic: boolean
  allowedUsers: mongoose.Types.ObjectId[]

  // 时间戳
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

**Schema定义**：

```typescript
const VoiceprintSchema = new Schema<IVoiceprint>({
  speakerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // ...
  ownerId: {
    type: Schema.Types.ObjectId,  // ⚠️ MongoDB ObjectId类型
    ref: 'User',                  // 引用User集合
    required: true                // ⚠️ 必填字段
  },
  // ...
})
```

**用途**：
- `ownerId` 是声纹的**所有者用户ID**
- 类型是 MongoDB ObjectId
- 用于权限控制、查询用户的声纹列表
- **必填**字段

---

### 3. 3D-Speaker服务 (backend/python-services/speaker_service/)

```python
def register_speaker(
    self,
    name: str,
    audio_path: str,
    user_id: Optional[str] = None,    # ⚠️ 可选的用户标识
    email: Optional[str] = None
) -> Dict:
    # 创建声纹信息
    voiceprint = {
        'speaker_id': speaker_id,      # MD5生成的声纹ID
        'name': name,
        'user_id': user_id,            # ⚠️ 存储传入的user_id（可选）
        'email': email,
        'embedding': embedding.tolist(),
        'created_at': self._get_timestamp(),
        'sample_count': 1
    }
    # ...
```

**用途**：
- `user_id` 是一个**可选**字段
- 存储在JSON文件中，但不参与声纹识别
- 仅用于业务关联和查询

---

## 数据流向图

### 声纹注册流程

```
┌─────────────────┐
│     前端        │
│  user_id (可选) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│    Node.js Backend              │
│                                 │
│  1. 从JWT获取当前登录用户ID     │
│     currentUserId (ObjectId)    │
│                                 │
│  2. 注册到MongoDB:              │
│     ownerId = currentUserId     │ ← ⚠️ 使用登录用户ID
│                                 │
│  3. 调用3D-Speaker服务:         │
│     user_id = currentUserId     │ ← ⚠️ 传递ObjectId字符串
│                                 │
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌─────────────┐  ┌─────────────────┐
│   MongoDB   │  │  3D-Speaker服务 │
│             │  │                 │
│ ownerId:    │  │ user_id:        │
│ ObjectId    │  │ string (可选)   │
└─────────────┘  └─────────────────┘
```

---

## 关键代码路径

### 1. 后端注册逻辑

**文件**: `backend/src/services/voiceprintManagementService.ts:67-135`

```typescript
async register(request: RegisterVoiceprintRequest): Promise<IVoiceprint> {
  // request.ownerId 来自当前登录用户
  logger.info(`注册声纹: ${request.name}`, { ownerId: request.ownerId })

  // 调用3D-Speaker服务
  const speakerProfile = await speakerRecognitionService.registerSpeaker(
    request.ownerId,  // ⚠️ 作为userId传递给3D-Speaker
    request.name,
    firstSample.path,
    request.email
  )

  // 创建MongoDB文档
  const voiceprint = new Voiceprint({
    speakerId: speakerProfile.speaker_id,
    name: request.name,
    ownerId: request.ownerId,  // ⚠️ 存储为所有者ID
    // ...
  })
}
```

### 2. 调用3D-Speaker服务

**文件**: `backend/src/services/speakerRecognitionService.ts:82-127`

```typescript
async registerSpeaker(
  userId: string,        // ⚠️ 接收ownerId（字符串格式）
  name: string,
  audioPath: string,
  email?: string
): Promise<SpeakerProfile> {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('user_id', userId)  // ⚠️ 传递给Python服务

  // 发送到 http://localhost:5002/api/speaker/register
  const response = await this.httpClient.post('/api/speaker/register', formData)
  // ...
}
```

### 3. 控制器层

**文件**: `backend/src/controllers/voiceprintController.ts:43-116`

```typescript
export const registerVoiceprint = async (req: AuthenticatedRequest, res: Response) => {
  const { name, department, position, email, phone } = req.body
  const userId = req.user!._id  // ⚠️ 从JWT中获取当前登录用户ID

  const voiceprint = await voiceprintManagementService.register({
    name,
    ownerId: userId,  // ⚠️ 使用登录用户ID作为ownerId
    // ...
  })
}
```

---

## 实际数据示例

### MongoDB Voiceprint文档

```json
{
  "_id": "68fb2fc6efab2e7f39f54581",           // MongoDB自动生成
  "speakerId": "564cdbf0185c1f4c173ad1baddaa4a84",  // 3D-Speaker的speaker_id
  "name": "林彪",
  "department": "测试部门",
  "email": null,
  "ownerId": "68fb1234efab2e7f39f54582",       // ⚠️ 所有者用户ID (ObjectId)
  "isPublic": false,
  "allowedUsers": [],
  "samples": [...],
  "sampleCount": 3,
  "stats": {
    "totalMatches": 0,
    "avgConfidence": 0
  },
  "createdAt": "2025-10-24T07:50:30.000Z",
  "updatedAt": "2025-10-24T07:50:30.000Z"
}
```

### 3D-Speaker服务JSON文件

**文件**: `backend/python-services/data/voiceprints/564cdbf0185c1f4c173ad1baddaa4a84.json`

```json
{
  "speaker_id": "564cdbf0185c1f4c173ad1baddaa4a84",
  "name": "林彪",
  "user_id": "68fb1234efab2e7f39f54582",  // ⚠️ 从MongoDB传过来的ownerId
  "email": null,
  "embedding": [...],
  "embeddings_all": [[...]],
  "created_at": "2025-10-24T07:50:30.123456",
  "updated_at": "2025-10-24T07:50:30.123456",
  "sample_count": 1
}
```

---

## 重要区别和注意事项

### ⚠️ 两个不同的用户ID概念

1. **MongoDB的ownerId**
   - 类型：`mongoose.Types.ObjectId`
   - 用途：权限控制、关联User集合
   - 必填：是
   - 来源：JWT中的当前登录用户ID
   - 示例：`68fb1234efab2e7f39f54582`

2. **3D-Speaker的user_id**
   - 类型：`string` (可选)
   - 用途：业务关联、查询辅助
   - 必填：否
   - 来源：通常传递ownerId的字符串形式
   - 示例：`"68fb1234efab2e7f39f54582"` 或任意字符串

### 🔑 关键点

1. **前端不需要传递user_id**
   - 后端会自动使用登录用户的ID

2. **ownerId是权限控制的关键**
   - 用于判断谁可以查看、修改、删除声纹
   - 必须是MongoDB User集合中的有效ID

3. **3D-Speaker的user_id是可选的**
   - 仅用于3D-Speaker服务内部的业务关联
   - 不参与权限控制和声纹识别

4. **两者可以相同，但用途不同**
   - 通常会将ownerId的字符串形式传给3D-Speaker作为user_id
   - 但3D-Speaker不强制要求user_id

---

## 查询示例

### 查询某个用户的所有声纹

```typescript
// 使用ownerId查询
const voiceprints = await Voiceprint.find({
  ownerId: userId,  // ⚠️ MongoDB ObjectId
  deletedAt: null
})
```

### 查询可访问的声纹

```typescript
// 根据权限查询
const voiceprints = await Voiceprint.find({
  deletedAt: null,
  $or: [
    { ownerId: userId },           // 自己的声纹
    { isPublic: true },            // 公开的声纹
    { allowedUsers: userId }       // 被授权访问的声纹
  ]
})
```

---

## 前端开发建议

### 当前架构下（使用Python 3D-Speaker服务）

```typescript
// 前端可以不传user_id，Python服务会自动处理
const data: VoiceprintRegistrationData = {
  name: "张三",
  email: "zhangsan@example.com",
  audio: audioFile
  // user_id 不传
}

await registerVoiceprint(data)
```

### 如果切换到MongoDB后端API

```typescript
// 不需要传user_id，后端会从JWT获取
const formData = new FormData()
formData.append('name', "张三")
formData.append('department', "技术部")
formData.append('email', "zhangsan@example.com")
formData.append('audio', audioFile1)
formData.append('audio', audioFile2)
formData.append('audio', audioFile3)

// 后端会自动:
// 1. 从JWT获取currentUserId
// 2. 设置ownerId = currentUserId
// 3. 传递user_id给3D-Speaker
```

---

## 总结

| 问题 | 答案 |
|------|------|
| 前端的user_id对应后端哪个字段？ | 间接对应`ownerId`（后端会用登录用户ID覆盖） |
| 前端的user_id对应3D-Speaker哪个字段？ | 直接对应`user_id`（但通常后端会传ownerId） |
| 谁是声纹的所有者？ | `ownerId`字段标识的用户 |
| 3D-Speaker的user_id必填吗？ | 否，是可选字段 |
| 前端需要传user_id吗？ | 不需要，后端会自动处理 |
| ownerId从哪里来？ | JWT中的当前登录用户ID |

**最佳实践**：
- ✅ 前端不传user_id，让后端自动使用登录用户ID
- ✅ 后端将ownerId传递给3D-Speaker作为user_id
- ✅ 使用ownerId进行权限控制和数据查询
