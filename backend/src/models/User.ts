// @ts-nocheck
import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  _id: string
  username: string
  email: string
  password: string
  name: string
  avatar?: string
  role: 'admin' | 'user'
  isActive: boolean
  lastLoginAt?: Date
  preferences: {
    language: string
    theme: string
    notifications: boolean
    autoRecord: boolean
  }
  settings: {
    voiceprintEnabled: boolean
    emailNotifications: boolean
    transcriptionLanguage: string
    emailSignature: string
  }
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
  generateAuthToken(): string
  getPublicProfile(): Partial<IUser>
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  avatar: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  preferences: {
    language: {
      type: String,
      enum: ['zh-CN', 'en-US'],
      default: 'zh-CN',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    autoRecord: {
      type: Boolean,
      default: false,
    },
  },
  settings: {
    voiceprintEnabled: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    transcriptionLanguage: {
      type: String,
      enum: ['zh-CN', 'en-US', 'auto'],
      default: 'zh-CN',
    },
    emailSignature: {
      type: String,
      default: '',
    },
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret: any) {
      delete ret.password
      return ret
    },
  },
})

// 索引
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })
userSchema.index({ createdAt: -1 })

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// 密码比较方法
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// 生成认证令牌
userSchema.methods.generateAuthToken = function(): string {
  const jwt = require('jsonwebtoken')
  return jwt.sign(
    {
      userId: this._id,
      email: this.email,
      role: this.role
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// 获取公开信息
userSchema.methods.getPublicProfile = function(): Partial<IUser> {
  return {
    _id: this._id,
    username: this.username,
    name: this.name,
    avatar: this.avatar,
    role: this.role,
    preferences: this.preferences,
    settings: this.settings,
    createdAt: this.createdAt,
  }
}

// 静态方法：根据邮箱或用户名查找用户
userSchema.statics.findByEmailOrUsername = function(identifier: string) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  })
}

// 虚拟字段：会议数量
userSchema.virtual('meetingCount', {
  ref: 'Meeting',
  localField: '_id',
  foreignField: 'host',
  count: true
})

export const User = mongoose.model<IUser>('User', userSchema)