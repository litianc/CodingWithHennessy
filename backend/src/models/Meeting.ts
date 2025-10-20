// @ts-nocheck
import mongoose, { Document, Schema } from 'mongoose'

export interface IMeeting extends Document {
  _id: string
  title: string
  description?: string
  host: mongoose.Types.ObjectId
  participants: Array<{
    userId: mongoose.Types.ObjectId | string
    name: string
    email: string
    role: 'participant' | 'observer'
    joinedAt?: Date
    leftAt?: Date
  }>
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  settings: {
    allowRecording: boolean
    enableTranscription: boolean
    enableVoiceprint: boolean
    autoGenerateMinutes: boolean
    language: string
  }
  recording?: {
    id: string
    filename: string
    duration: number
    size: number
    format: string
    url: string
    startedAt: Date
    endedAt?: Date
  }
  transcriptions: Array<{
    id: string
    speakerId: string
    speakerName: string
    content: string
    timestamp: Date
    confidence: number
    startTime: number
    endTime: number
  }>
  minutes?: {
    id: string
    title: string
    summary: string
    keyPoints: string[]
    actionItems: Array<{
      description: string
      assignee: string
      dueDate?: Date
      priority: 'low' | 'medium' | 'high'
    }>
    decisions: Array<{
      description: string
      decisionMaker: string
      timestamp: Date
    }>
    generatedAt: Date
    status: 'draft' | 'reviewing' | 'approved'
  }
  scheduledStartTime?: Date
  scheduledEndTime?: Date
  actualStartTime?: Date
  actualEndTime?: Date
  createdAt: Date
  updatedAt: Date

  // 实例方法
  isHost(userId: string): boolean
  isParticipant(userId: string): boolean
  addParticipant(userId: string, name: string, email: string, role?: 'participant' | 'observer'): void
  removeParticipant(userId: string): void
  updateParticipantStatus(userId: string, status: 'joined' | 'left'): void
  startMeeting(): void
  endMeeting(): void
  addTranscription(speakerId: string, speakerName: string, content: string, confidence: number, startTime: number, endTime: number): void
}

export interface IMeetingModel extends mongoose.Model<IMeeting> {
  getUserMeetings(userId: string, options?: { status?: string; limit?: number; skip?: number }): Promise<IMeeting[]>
  getActiveMeetings(): Promise<IMeeting[]>
}

const meetingSchema = new Schema<IMeeting>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  host: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [{
    userId: {
      type: Schema.Types.Mixed,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['participant', 'observer'],
      default: 'participant',
    },
    joinedAt: {
      type: Date,
    },
    leftAt: {
      type: Date,
    },
  }],
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  settings: {
    allowRecording: {
      type: Boolean,
      default: true,
    },
    enableTranscription: {
      type: Boolean,
      default: true,
    },
    enableVoiceprint: {
      type: Boolean,
      default: true,
    },
    autoGenerateMinutes: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      enum: ['zh-CN', 'en-US', 'auto'],
      default: 'zh-CN',
    },
  },
  recording: {
    id: String,
    filename: String,
    duration: Number,
    size: Number,
    format: String,
    url: String,
    startedAt: Date,
    endedAt: Date,
  },
  transcriptions: [{
    id: {
      type: String,
      required: true,
    },
    speakerId: {
      type: String,
      required: true,
    },
    speakerName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    startTime: {
      type: Number,
      required: true,
    },
    endTime: {
      type: Number,
      required: true,
    },
  }],
  minutes: {
    id: String,
    title: String,
    summary: String,
    keyPoints: [String],
    actionItems: [{
      description: String,
      assignee: String,
      dueDate: Date,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
    }],
    decisions: [{
      description: String,
      decisionMaker: String,
      timestamp: Date,
    }],
    generatedAt: Date,
    status: {
      type: String,
      enum: ['draft', 'reviewing', 'approved'],
      default: 'draft',
    },
  },
  scheduledStartTime: Date,
  scheduledEndTime: Date,
  actualStartTime: Date,
  actualEndTime: Date,
}, {
  timestamps: true,
})

// 索引
meetingSchema.index({ host: 1, createdAt: -1 })
meetingSchema.index({ 'participants.userId': 1 })
meetingSchema.index({ status: 1 })
meetingSchema.index({ scheduledStartTime: 1 })

// 虚拟字段：参与者数量
meetingSchema.virtual('participantCount', {
  ref: 'Meeting',
  localField: '_id',
  foreignField: 'participants',
  count: true
})

// 实例方法：检查用户是否为会议主持人
meetingSchema.methods.isHost = function(userId: string): boolean {
  if (!this.host || !userId) return false
  // Demo mode: allow demo-user-id
  if (userId === 'demo-user-id') return true
  return this.host.toString() === userId
}

// 实例方法：检查用户是否为参与者
meetingSchema.methods.isParticipant = function(userId: string): boolean {
  if (!userId) return false
  // Demo mode: allow demo-user-id
  if (userId === 'demo-user-id') return true
  return this.participants.some((p: any) => p.userId && p.userId.toString() === userId)
}

// 实例方法：添加参与者
meetingSchema.methods.addParticipant = function(
  userId: string,
  name: string,
  email: string,
  role: 'participant' | 'observer' = 'participant'
): void {
  if (!this.isParticipant(userId)) {
    this.participants.push({
      userId,
      name,
      email,
      role,
      joinedAt: new Date(),
    })
  }
}

// 实例方法：移除参与者
meetingSchema.methods.removeParticipant = function(userId: string): void {
  const participantIndex = this.participants.findIndex(
    (p: any) => p.userId.toString() === userId
  )
  if (participantIndex !== -1) {
    this.participants[participantIndex].leftAt = new Date()
  }
}

// 实例方法：更新参与者状态
meetingSchema.methods.updateParticipantStatus = function(
  userId: string,
  status: 'joined' | 'left'
): void {
  const participant = this.participants.find(
    (p: any) => p.userId.toString() === userId
  )
  if (participant) {
    if (status === 'joined') {
      participant.joinedAt = participant.joinedAt || new Date()
      participant.leftAt = undefined
    } else {
      participant.leftAt = new Date()
    }
  }
}

// 实例方法：开始会议
meetingSchema.methods.startMeeting = function(): void {
  this.status = 'in_progress'
  this.actualStartTime = new Date()
}

// 实例方法：结束会议
meetingSchema.methods.endMeeting = function(): void {
  this.status = 'completed'
  this.actualEndTime = new Date()

  // 更新所有未离开的参与者的离开时间
  this.participants.forEach((participant: any) => {
    if (!participant.leftAt) {
      participant.leftAt = new Date()
    }
  })
}

// 实例方法：添加转录内容
meetingSchema.methods.addTranscription = function(
  speakerId: string,
  speakerName: string,
  content: string,
  confidence: number,
  startTime: number,
  endTime: number
): void {
  this.transcriptions.push({
    id: Math.random().toString(36).substring(2, 15),
    speakerId,
    speakerName,
    content,
    timestamp: new Date(),
    confidence,
    startTime,
    endTime,
  })
}

// 静态方法：获取用户的会议
meetingSchema.statics.getUserMeetings = function(
  userId: string,
  options: {
    status?: string
    limit?: number
    skip?: number
  } = {}
) {
  const query: any = {
    $or: [
      { host: userId },
      { 'participants.userId': userId }
    ]
  }

  if (options.status) {
    query.status = options.status
  }

  return this.find(query)
    .populate('host', 'username name avatar')
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
}

// 静态方法：获取活跃会议
meetingSchema.statics.getActiveMeetings = function() {
  return this.find({ status: 'in_progress' })
    .populate('host', 'username name avatar')
    .sort({ actualStartTime: -1 })
}

export const Meeting = mongoose.model<IMeeting, IMeetingModel>('Meeting', meetingSchema)