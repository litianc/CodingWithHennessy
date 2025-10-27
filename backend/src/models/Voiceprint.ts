import mongoose, { Document, Schema } from 'mongoose'

/**
 * 声纹样本接口
 */
export interface IAudioSample {
  filename: string
  path: string
  duration: number
  sampleRate: number
  createdAt: Date
}

/**
 * 声纹特征向量接口
 */
export interface IEmbedding {
  vector: number[] // 声纹特征向量
  dim: number // 特征维度
  modelVersion: string // 模型版本
}

/**
 * 声纹统计信息接口
 */
export interface IVoiceprintStats {
  totalMatches: number // 总匹配次数
  avgConfidence: number // 平均置信度
  lastMatchedAt?: Date // 最后匹配时间
}

/**
 * 声纹文档接口
 */
export interface IVoiceprint extends Document {
  _id: string
  speakerId: string // 3D-Speaker服务的speaker_id（MD5格式）
  name: string // 姓名
  department?: string // 部门
  position?: string // 职位
  email?: string // 邮箱
  phone?: string // 电话

  // 声纹数据
  embedding: IEmbedding // 声纹特征向量

  // 音频样本
  samples: IAudioSample[] // 音频样本列表
  sampleCount: number // 样本数量

  // 统计信息
  stats: IVoiceprintStats

  // 访问控制
  ownerId: mongoose.Types.ObjectId // 所有者用户ID
  isPublic: boolean // 是否公开
  allowedUsers: mongoose.Types.ObjectId[] // 允许访问的用户列表

  // 时间戳
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date // 软删除

  // 实例方法
  updateMatchStats(confidence: number): void
  addSample(sample: Omit<IAudioSample, 'createdAt'>): void
  softDelete(): void
  restore(): void
}

/**
 * 音频样本Schema
 */
const AudioSampleSchema = new Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  duration: { type: Number, required: true },
  sampleRate: { type: Number, required: true, default: 16000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false })

/**
 * 声纹特征向量Schema
 */
const EmbeddingSchema = new Schema({
  vector: { type: [Number], required: true },
  dim: { type: Number, required: true, default: 192 },
  modelVersion: { type: String, required: true, default: '3D-Speaker-v1' }
}, { _id: false })

/**
 * 声纹统计信息Schema
 */
const VoiceprintStatsSchema = new Schema({
  totalMatches: { type: Number, default: 0 },
  avgConfidence: { type: Number, default: 0 },
  lastMatchedAt: { type: Date }
}, { _id: false })

/**
 * 声纹Schema
 */
const VoiceprintSchema = new Schema<IVoiceprint>({
  speakerId: {
    type: String,
    required: [true, '3D-Speaker ID不能为空'],
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, '姓名不能为空'],
    trim: true,
    maxlength: [100, '姓名不能超过100个字符']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, '部门名称不能超过100个字符']
  },
  position: {
    type: String,
    trim: true,
    maxlength: [100, '职位名称不能超过100个字符']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  phone: {
    type: String,
    trim: true
  },

  // 声纹数据
  embedding: {
    type: EmbeddingSchema,
    required: [true, '声纹特征向量不能为空']
  },

  // 音频样本
  samples: {
    type: [AudioSampleSchema],
    default: []
  },
  sampleCount: {
    type: Number,
    default: 0
  },

  // 统计信息
  stats: {
    type: VoiceprintStatsSchema,
    default: () => ({
      totalMatches: 0,
      avgConfidence: 0
    })
  },

  // 访问控制
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  allowedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // 软删除
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'voiceprints'
})

// 索引
VoiceprintSchema.index({ name: 1 })
VoiceprintSchema.index({ department: 1 })
VoiceprintSchema.index({ ownerId: 1 })
VoiceprintSchema.index({ 'stats.lastMatchedAt': -1 })
VoiceprintSchema.index({ deletedAt: 1 }) // 用于软删除查询

// 复合索引
VoiceprintSchema.index({ ownerId: 1, deletedAt: 1 })
VoiceprintSchema.index({ isPublic: 1, deletedAt: 1 })

// 方法：更新匹配统计
VoiceprintSchema.methods.updateMatchStats = function(confidence: number): void {
  this.stats.totalMatches += 1
  // 更新平均置信度
  const oldTotal = this.stats.totalMatches - 1
  const oldAvg = this.stats.avgConfidence || 0
  this.stats.avgConfidence = (oldAvg * oldTotal + confidence) / this.stats.totalMatches
  this.stats.lastMatchedAt = new Date()
}

// 方法：添加音频样本
VoiceprintSchema.methods.addSample = function(sample: Omit<IAudioSample, 'createdAt'>): void {
  this.samples.push({
    ...sample,
    createdAt: new Date()
  })
  this.sampleCount = this.samples.length
}

// 方法：软删除
VoiceprintSchema.methods.softDelete = function(): void {
  this.deletedAt = new Date()
}

// 方法：恢复
VoiceprintSchema.methods.restore = function(): void {
  this.deletedAt = null
}

// 静态方法：查询未删除的声纹
VoiceprintSchema.statics.findActive = function(conditions: any = {}) {
  return this.find({ ...conditions, deletedAt: null })
}

// 静态方法：查询用户可访问的声纹
VoiceprintSchema.statics.findAccessible = function(userId: string, conditions: any = {}) {
  return this.find({
    ...conditions,
    deletedAt: null,
    $or: [
      { ownerId: userId },
      { isPublic: true },
      { allowedUsers: userId }
    ]
  })
}

// 虚拟字段：获取声纹ID的字符串形式
VoiceprintSchema.virtual('id').get(function() {
  return this._id.toString()
})

// 转换为JSON时的配置
VoiceprintSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  }
})

// 导出模型
export const Voiceprint = mongoose.model<IVoiceprint>('Voiceprint', VoiceprintSchema)
