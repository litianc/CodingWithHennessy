# 声纹所有权字段重新设计

## 当前问题分析

### 问题场景

**当前设计**：
```typescript
{
  ownerId: ObjectId  // 注册声纹的用户ID
}
```

**实际场景**：
```
秘书（userId: "secretary_001"）为多位领导注册声纹：
├── 注册林彪的声纹    → ownerId: "secretary_001" ❌ 错误！应该属于林彪
├── 注册刘亚楼的声纹  → ownerId: "secretary_001" ❌ 错误！应该属于刘亚楼
└── 注册罗荣桓的声纹  → ownerId: "secretary_001" ❌ 错误！应该属于罗荣桓
```

**问题**：
- ❌ `ownerId` 表示"谁注册的"，而不是"声纹属于谁"
- ❌ 查询某人的声纹会失败（因为 ownerId 是秘书的ID）
- ❌ 权限控制逻辑混乱

---

## 解决方案

### 方案A：区分注册者和所属人（推荐）

```typescript
interface IVoiceprint {
  _id: string
  speakerId: string  // 3D-Speaker ID

  // 身份信息
  name: string       // 声纹所属人的姓名
  department?: string
  position?: string
  email?: string
  phone?: string

  // 关联信息（新增）
  userId?: ObjectId           // 声纹所属人的用户ID（如果是系统用户）
  createdBy: ObjectId         // 注册者的用户ID（原 ownerId）

  // 访问控制
  isPublic: boolean
  allowedUsers: ObjectId[]

  // ... 其他字段
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 声纹所属人的姓名（如"林彪"） |
| `userId` | ObjectId | ❌ | 如果声纹所属人是系统用户，存储其用户ID |
| `createdBy` | ObjectId | ✅ | 注册声纹的人（如秘书的ID） |
| `email` | string | ❌ | 声纹所属人的邮箱（用于通知等） |

**优点**：
- ✅ 清晰区分"谁注册"和"属于谁"
- ✅ 支持为非系统用户注册声纹
- ✅ 保留审计追踪（知道谁注册的）

**使用示例**：
```typescript
// 秘书为林彪注册声纹
{
  name: "林彪",
  userId: null,              // 林彪不是系统用户
  createdBy: "secretary_001", // 秘书注册的
  email: "linbiao@example.com"
}

// 用户为自己注册声纹
{
  name: "张三",
  userId: "zhangsan_id",      // 张三的用户ID
  createdBy: "zhangsan_id",   // 自己注册的
  email: "zhangsan@example.com"
}
```

---

### 方案B：完全移除用户关联（简化方案）

```typescript
interface IVoiceprint {
  _id: string
  speakerId: string

  // 身份信息（通过姓名/邮箱/部门等识别）
  name: string
  department?: string
  position?: string
  email?: string
  phone?: string

  // 无用户ID关联
  // 完全依赖姓名、邮箱等字段

  isPublic: boolean
  allowedUsers: ObjectId[]  // 谁可以访问这个声纹
}
```

**优点**：
- ✅ 最简单
- ✅ 适合声纹管理独立于用户系统的场景

**缺点**：
- ❌ 无法追踪谁注册的
- ❌ 如果声纹所属人也是系统用户，无法关联

---

### 方案C：双重所有权（复杂但灵活）

```typescript
interface IVoiceprint {
  // 所属人信息
  owner: {
    type: 'user' | 'external'  // 系统用户 或 外部人员
    userId?: ObjectId           // 如果是系统用户
    name: string                // 姓名
    email?: string
    phone?: string
  }

  // 管理信息
  createdBy: ObjectId          // 注册者
  managedBy: ObjectId[]        // 可以管理此声纹的用户列表
}
```

**优点**：
- ✅ 最灵活
- ✅ 支持各种场景

**缺点**：
- ❌ 复杂度高

---

## 推荐方案：方案A

### 新的字段结构

```typescript
export interface IVoiceprint extends Document {
  _id: string
  speakerId: string

  // === 声纹所属人信息 ===
  name: string                    // 必填：姓名
  department?: string             // 可选：部门
  position?: string               // 可选：职位
  email?: string                  // 可选：邮箱
  phone?: string                  // 可选：电话
  userId?: mongoose.Types.ObjectId // 可选：如果是系统用户，存储用户ID

  // === 管理信息 ===
  createdBy: mongoose.Types.ObjectId  // 必填：注册者ID

  // === 访问控制 ===
  isPublic: boolean               // 是否公开
  allowedUsers: mongoose.Types.ObjectId[] // 授权访问的用户列表

  // === 声纹数据 ===
  embedding: IEmbedding
  samples: IAudioSample[]
  sampleCount: number
  stats: IVoiceprintStats

  // === 时间戳 ===
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

### Schema 定义

```typescript
const VoiceprintSchema = new Schema<IVoiceprint>({
  speakerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // 声纹所属人信息
  name: {
    type: String,
    required: [true, '姓名不能为空'],
    trim: true,
    index: true
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  position: String,
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址'],
    index: true
  },
  phone: String,

  // 如果声纹所属人是系统用户，存储其ID
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },

  // 注册者（替代原来的 ownerId）
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '注册者ID不能为空'],
    index: true
  },

  // 访问控制
  isPublic: {
    type: Boolean,
    default: false
  },
  allowedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // ... 其他字段保持不变
})

// 索引优化
VoiceprintSchema.index({ name: 1, department: 1 })
VoiceprintSchema.index({ userId: 1, deletedAt: 1 })
VoiceprintSchema.index({ createdBy: 1, deletedAt: 1 })
VoiceprintSchema.index({ email: 1 })
```

---

## 权限控制逻辑调整

### 旧的权限逻辑（基于 ownerId）

```typescript
// 检查用户是否可以访问声纹
function hasAccess(voiceprint, userId) {
  return voiceprint.ownerId === userId ||  // 是所有者
         voiceprint.isPublic ||             // 或公开
         voiceprint.allowedUsers.includes(userId) // 或被授权
}
```

### 新的权限逻辑

```typescript
// 检查用户是否可以访问声纹
function hasAccess(voiceprint: IVoiceprint, userId: string): boolean {
  // 1. 如果是声纹所属人（是系统用户的情况）
  if (voiceprint.userId && voiceprint.userId.toString() === userId) {
    return true
  }

  // 2. 如果是注册者
  if (voiceprint.createdBy.toString() === userId) {
    return true
  }

  // 3. 如果是公开的
  if (voiceprint.isPublic) {
    return true
  }

  // 4. 如果在授权列表中
  if (voiceprint.allowedUsers.some(id => id.toString() === userId)) {
    return true
  }

  return false
}

// 检查用户是否可以修改声纹
function canModify(voiceprint: IVoiceprint, userId: string): boolean {
  // 只有注册者可以修改
  return voiceprint.createdBy.toString() === userId
}

// 检查用户是否可以删除声纹
function canDelete(voiceprint: IVoiceprint, userId: string): boolean {
  // 注册者或声纹所属人（如果是系统用户）可以删除
  return voiceprint.createdBy.toString() === userId ||
         (voiceprint.userId && voiceprint.userId.toString() === userId)
}
```

---

## 查询场景

### 1. 查询某个人的声纹

```typescript
// 旧方式（基于 ownerId）
const voiceprints = await Voiceprint.find({ ownerId: userId })

// 新方式（多种查询）

// 按姓名查询
const voiceprints = await Voiceprint.find({
  name: "林彪",
  deletedAt: null
})

// 按邮箱查询
const voiceprints = await Voiceprint.find({
  email: "linbiao@example.com",
  deletedAt: null
})

// 按系统用户ID查询（如果是系统用户）
const voiceprints = await Voiceprint.find({
  userId: userId,
  deletedAt: null
})

// 查询我注册的所有声纹
const voiceprints = await Voiceprint.find({
  createdBy: currentUserId,
  deletedAt: null
})

// 查询我可以访问的所有声纹
const voiceprints = await Voiceprint.find({
  deletedAt: null,
  $or: [
    { userId: currentUserId },           // 我的声纹
    { createdBy: currentUserId },        // 我注册的
    { isPublic: true },                  // 公开的
    { allowedUsers: currentUserId }      // 授权给我的
  ]
})
```

### 2. 统计查询

```typescript
// 统计各部门的声纹数量
const stats = await Voiceprint.aggregate([
  { $match: { deletedAt: null } },
  { $group: {
      _id: '$department',
      count: { $sum: 1 }
  }}
])

// 统计每个注册者注册了多少声纹
const registrarStats = await Voiceprint.aggregate([
  { $match: { deletedAt: null } },
  { $group: {
      _id: '$createdBy',
      count: { $sum: 1 }
  }}
])
```

---

## 注册流程调整

### Controller层

```typescript
export const registerVoiceprint = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const {
    name,           // 必填：声纹所属人姓名
    department,     // 可选
    position,       // 可选
    email,          // 可选
    phone,          // 可选
    userId,         // 可选：如果声纹所属人是系统用户
    isPublic,
    allowedUsers
  } = req.body

  const currentUserId = req.user!._id  // 当前登录用户（注册者）

  const voiceprint = await voiceprintManagementService.register({
    name,
    department,
    position,
    email,
    phone,
    userId: userId || null,     // 声纹所属人的用户ID（可选）
    createdBy: currentUserId,   // 注册者ID
    audioSamples,
    isPublic: isPublic === 'true' || isPublic === true,
    allowedUsers: allowedUsers ? JSON.parse(allowedUsers) : []
  })

  res.status(201).json({
    success: true,
    data: voiceprint
  })
}
```

### Service层

```typescript
export interface RegisterVoiceprintRequest {
  name: string                  // 必填
  department?: string
  position?: string
  email?: string
  phone?: string
  userId?: string              // 可选：声纹所属人的用户ID
  createdBy: string            // 必填：注册者ID
  audioSamples: Array<{...}>
  isPublic?: boolean
  allowedUsers?: string[]
}

async register(request: RegisterVoiceprintRequest): Promise<IVoiceprint> {
  // 验证 userId（如果提供）
  if (request.userId) {
    const user = await User.findById(request.userId)
    if (!user) {
      throw new Error('指定的用户ID不存在')
    }
  }

  // 调用3D-Speaker注册
  const speakerProfile = await speakerRecognitionService.registerSpeaker(
    request.createdBy,  // 传递注册者ID给3D-Speaker
    request.name,
    firstSample.path,
    request.email
  )

  // 创建声纹文档
  const voiceprint = new Voiceprint({
    speakerId: speakerProfile.speaker_id,
    name: request.name,
    department: request.department,
    position: request.position,
    email: request.email,
    phone: request.phone,
    userId: request.userId || null,     // 声纹所属人ID（可选）
    createdBy: request.createdBy,       // 注册者ID
    isPublic: request.isPublic || false,
    allowedUsers: request.allowedUsers || [],
    // ... 其他字段
  })

  await voiceprint.save()
  return voiceprint
}
```

---

## 前端界面调整

### 注册表单

```typescript
<Form>
  <Form.Item
    name="name"
    label="姓名"
    rules={[{ required: true, message: '请输入姓名' }]}
  >
    <Input placeholder="声纹所属人的姓名" />
  </Form.Item>

  <Form.Item
    name="department"
    label="部门"
  >
    <Input />
  </Form.Item>

  <Form.Item
    name="position"
    label="职位"
  >
    <Input />
  </Form.Item>

  <Form.Item
    name="email"
    label="邮箱"
  >
    <Input type="email" />
  </Form.Item>

  <Form.Item
    name="userId"
    label="关联用户"
    help="如果声纹所属人是系统用户，选择对应用户"
  >
    <Select
      allowClear
      showSearch
      placeholder="可选：选择系统用户"
      options={systemUsers}
    />
  </Form.Item>

  <Form.Item
    name="audioFiles"
    label="音频样本"
    rules={[{ required: true, message: '请上传至少3个音频样本' }]}
  >
    <Upload multiple maxCount={10} accept="audio/*">
      <Button icon={<UploadOutlined />}>
        上传音频样本（至少3个）
      </Button>
    </Upload>
  </Form.Item>
</Form>
```

### 列表显示

```typescript
const columns = [
  {
    title: '姓名',
    dataIndex: 'name',
    key: 'name',
    render: (name, record) => (
      <Space>
        <UserOutlined />
        <Text strong>{name}</Text>
        {record.userId && <Tag color="blue">系统用户</Tag>}
      </Space>
    )
  },
  {
    title: '部门/职位',
    key: 'org',
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        {record.department && <Tag color="blue">{record.department}</Tag>}
        {record.position && <Tag color="green">{record.position}</Tag>}
      </Space>
    )
  },
  {
    title: '联系方式',
    key: 'contact',
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        {record.email && <Text>{record.email}</Text>}
        {record.phone && <Text>{record.phone}</Text>}
      </Space>
    )
  },
  {
    title: '注册者',
    dataIndex: 'createdBy',
    key: 'createdBy',
    render: (createdBy) => (
      <Text type="secondary">{createdBy.name}</Text>
    )
  },
  // ... 其他列
]
```

---

## 数据迁移

### 迁移策略

```typescript
// 迁移脚本：将 ownerId 改为 createdBy
async function migrateOwnerIdToCreatedBy() {
  const voiceprints = await Voiceprint.find()

  for (const vp of voiceprints) {
    // 1. 将 ownerId 改为 createdBy
    vp.createdBy = vp.ownerId

    // 2. 尝试根据姓名匹配系统用户
    const user = await User.findOne({
      name: vp.name,
      email: vp.email
    })

    if (user) {
      vp.userId = user._id
      console.log(`✓ 找到匹配用户: ${vp.name} -> ${user._id}`)
    } else {
      vp.userId = null
      console.log(`○ 未找到匹配用户: ${vp.name}（将作为外部人员）`)
    }

    // 3. 删除旧的 ownerId 字段
    delete vp.ownerId

    await vp.save()
  }
}
```

---

## 总结

### 字段对比

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| `ownerId` | `createdBy` | 注册声纹的人 |
| - | `userId` | 声纹所属人的用户ID（可选） |
| `name` | `name` | 声纹所属人的姓名 |

### 优势

1. ✅ **语义清晰**：区分"谁注册"和"属于谁"
2. ✅ **灵活性高**：支持为非系统用户注册声纹
3. ✅ **审计完整**：保留注册者信息
4. ✅ **查询方便**：可以按姓名、邮箱、部门等多种方式查询
5. ✅ **权限明确**：清晰的权限控制逻辑

### 适用场景

- ✅ 秘书为多位领导注册声纹
- ✅ 管理员为员工批量注册声纹
- ✅ 用户为自己注册声纹
- ✅ HR为应聘者注册声纹（非系统用户）
