// @ts-nocheck
/**
 * 会议纪要生成集成测试
 * 测试音频上传 → 语音识别 → AI纪要生成的完整流程
 */

import request from 'supertest'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'
import { app } from '@/tests/testApp'
import { User } from '@/models/User'
import { Meeting } from '@/models/Meeting'
import { generateTokens } from '@/middleware/auth'
import { audioService } from '@/services/audioService'

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  }
}))

// Mock Socket.IO
jest.mock('@/utils/socket', () => ({
  emitToMeeting: jest.fn(),
  emitToUser: jest.fn()
}))

// Mock 语音识别服务
jest.mock('@/services/speechRecognitionService', () => ({
  speechService: {
    recognizeFromFile: jest.fn().mockResolvedValue([
      {
        text: '大家好,今天我们来讨论一下项目的进展情况。',
        confidence: 0.95,
        speakerId: 'speaker_1',
        speakerName: '张三',
        startTime: 0,
        endTime: 3.5,
        words: []
      },
      {
        text: '我负责的前端部分已经完成了百分之八十。',
        confidence: 0.92,
        speakerId: 'speaker_1',
        speakerName: '张三',
        startTime: 3.5,
        endTime: 6.8,
        words: []
      },
      {
        text: '后端API还有几个接口需要优化,预计本周完成。',
        confidence: 0.88,
        speakerId: 'speaker_2',
        speakerName: '李四',
        startTime: 7.0,
        endTime: 11.2,
        words: []
      },
      {
        text: '好的,那我们定一下下周的目标。张三负责完成UI优化,李四负责完成所有API。',
        confidence: 0.93,
        speakerId: 'speaker_3',
        speakerName: '王五',
        startTime: 11.5,
        endTime: 17.0,
        words: []
      }
    ])
  }
}))

// Mock AI服务
jest.mock('@/services/aiService', () => ({
  aiService: {
    generateMeetingMinutes: jest.fn().mockResolvedValue({
      title: '项目进展讨论会议',
      summary: '团队讨论了项目当前进展,前端已完成80%,后端API开发中。确定了下周的工作目标和责任人。',
      keyPoints: [
        '前端开发进度:已完成80%',
        '后端API开发中,本周完成优化',
        '下周目标:UI优化和API完成'
      ],
      actionItems: [
        {
          description: '完成UI优化',
          assignee: '张三',
          priority: 'high'
        },
        {
          description: '完成所有API开发',
          assignee: '李四',
          priority: 'high'
        }
      ],
      decisions: [
        {
          description: '确定下周工作目标和责任人',
          decisionMaker: '王五',
          context: '项目进度讨论'
        }
      ],
      nextSteps: [
        '张三:完成UI优化',
        '李四:完成所有API开发',
        '下周一进行进度回顾'
      ]
    }),
    optimizeMeetingMinutes: jest.fn().mockResolvedValue({
      title: '项目进展讨论会议(优化版)',
      summary: '团队进行了深入的项目进展讨论。前端开发已完成80%,主要功能已实现。后端API开发进度良好,本周将完成剩余接口的优化工作。会议明确了下周的工作重点和责任分工。',
      keyPoints: [
        '前端开发进度:已完成80%,主要功能实现',
        '后端API开发顺利,本周完成优化',
        '明确下周目标:UI优化和API全部完成',
        '建立了清晰的责任分工'
      ],
      actionItems: [
        {
          description: '完成UI优化工作',
          assignee: '张三',
          priority: 'high'
        },
        {
          description: '完成所有后端API开发',
          assignee: '李四',
          priority: 'high'
        },
        {
          description: '准备下周一进度回顾材料',
          assignee: '王五',
          priority: 'medium'
        }
      ],
      decisions: [
        {
          description: '确定下周工作目标和责任人分配',
          decisionMaker: '王五',
          context: '项目进度讨论会'
        }
      ],
      nextSteps: [
        '张三:本周完成UI优化',
        '李四:本周完成所有API开发',
        '王五:准备下周一进度回顾',
        '团队:下周一上午10点进行进度回顾会议'
      ]
    }),
    checkAvailability: jest.fn().mockResolvedValue(true)
  }
}))

// Mock 声纹识别服务
jest.mock('@/services/voiceprintService', () => ({
  voiceprintService: {
    identifySpeakers: jest.fn().mockResolvedValue([
      { speakerId: 'speaker_1', name: '张三', email: 'zhangsan@example.com', confidence: 0.95 },
      { speakerId: 'speaker_2', name: '李四', email: 'lisi@example.com', confidence: 0.92 },
      { speakerId: 'speaker_3', name: '王五', email: 'wangwu@example.com', confidence: 0.88 }
    ])
  }
}))

describe('Meeting Minutes Generation Integration Tests', () => {
  let authToken: string
  let testUser: any
  let testMeeting: any
  let testAudioBuffer: Buffer

  beforeAll(async () => {
    // 检查 MongoDB 连接状态
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  Skipping integration tests: MongoDB is not connected')
      return
    }

    console.log('✅ MongoDB connected, running integration tests...')

    // 创建测试用户
    testUser = new User({
      username: 'minutes_test_user',
      email: 'minutestest@example.com',
      password: 'password123',
      name: 'Minutes Test User'
    })
    await testUser.save()

    // 生成认证令牌
    const tokens = generateTokens(testUser)
    authToken = tokens.accessToken

    // 创建测试会议
    testMeeting = new Meeting({
      title: 'Minutes Generation Test Meeting',
      description: '测试会议纪要生成',
      host: testUser._id,
      participants: [
        {
          userId: testUser._id,
          name: '张三',
          email: 'zhangsan@example.com',
          role: 'participant'
        }
      ],
      status: 'in_progress',
      settings: {
        allowRecording: true,
        enableTranscription: true,
        enableVoiceprint: true,
        autoGenerateMinutes: true,
        language: 'zh-CN'
      }
    })
    await testMeeting.save()

    // 创建测试音频buffer (模拟WAV文件头)
    testAudioBuffer = Buffer.from(
      'RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x08\x00\x00\x00\x00\x00\x00'
    )
  })

  afterAll(async () => {
    // 清理测试数据
    if (testUser) {
      await User.deleteMany({ email: 'minutestest@example.com' })
    }
    if (testMeeting) {
      await Meeting.deleteMany({ _id: testMeeting._id })
    }

    // 清理测试文件
    const testFiles = await fs.promises.readdir('./uploads').catch(() => [])
    for (const file of testFiles) {
      if (file.includes('minutes-test')) {
        await fs.promises.unlink(`./uploads/${file}`).catch(() => {})
      }
    }
  })

  describe('POST /api/meetings/:meetingId/upload-audio - 音频上传并生成纪要', () => {
    it('应该成功上传音频文件并自动生成会议纪要', async () => {
      if (!testUser || !testMeeting) {
        console.warn('Skipping test: MongoDB not connected')
        return
      }

      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioBuffer, 'test-meeting.wav')
        .field('autoGenerateMinutes', 'true')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('audioFile')
      expect(response.body.data).toHaveProperty('transcriptions')
      expect(response.body.data).toHaveProperty('minutes')

      // 验证转录结果
      expect(response.body.data.transcriptions).toBeInstanceOf(Array)
      expect(response.body.data.transcriptions.length).toBeGreaterThan(0)
      expect(response.body.data.transcriptions[0]).toHaveProperty('speakerName')
      expect(response.body.data.transcriptions[0]).toHaveProperty('content')

      // 验证会议纪要
      expect(response.body.data.minutes).toHaveProperty('title')
      expect(response.body.data.minutes).toHaveProperty('summary')
      expect(response.body.data.minutes).toHaveProperty('keyPoints')
      expect(response.body.data.minutes).toHaveProperty('actionItems')
      expect(response.body.data.minutes.keyPoints).toBeInstanceOf(Array)
      expect(response.body.data.minutes.actionItems).toBeInstanceOf(Array)

      // 验证数据库中的记录
      const updatedMeeting = await Meeting.findById(testMeeting._id)
      expect(updatedMeeting?.transcriptions.length).toBeGreaterThan(0)
      expect(updatedMeeting?.minutes).toBeDefined()
      expect(updatedMeeting?.minutes?.title).toBe('项目进展讨论会议')
    }, 30000)

    it('应该支持上传音频但不自动生成纪要', async () => {
      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioBuffer, 'test-meeting-2.wav')
        .field('autoGenerateMinutes', 'false')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('audioFile')
      expect(response.body.data).toHaveProperty('transcriptions')
      expect(response.body.data).not.toHaveProperty('minutes')
    }, 30000)

    it('应该拒绝非音频文件', async () => {
      const textBuffer = Buffer.from('This is not an audio file')

      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', textBuffer, 'test.txt')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('文件类型')
    })

    it('应该拒绝超大文件', async () => {
      // 模拟一个超大文件 (>100MB)
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024)

      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', largeBuffer, 'large-file.wav')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('文件大小')
    })

    it('应该拒绝未授权用户上传音频', async () => {
      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .attach('audio', testAudioBuffer, 'test-meeting.wav')

      expect(response.status).toBe(401)
    })

    it('应该拒绝非会议参与者上传音频', async () => {
      // 创建另一个用户
      const otherUser = new User({
        username: 'other_user',
        email: 'otheruser@example.com',
        password: 'password123',
        name: 'Other User'
      })
      await otherUser.save()

      const tokens = generateTokens(otherUser)
      const otherToken = tokens.accessToken

      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('audio', testAudioBuffer, 'test-meeting.wav')

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)

      // 清理
      await User.findByIdAndDelete(otherUser._id)
    })

    it('应该拒绝对不存在的会议上传音频', async () => {
      const fakeId = new mongoose.Types.ObjectId()

      const response = await request(app)
        .post(`/api/meetings/${fakeId}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioBuffer, 'test-meeting.wav')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/ai/minutes/generate - 手动触发纪要生成', () => {
    beforeEach(async () => {
      // 添加一些转录内容
      testMeeting.transcriptions = [
        {
          id: 'trans_1',
          speakerId: 'speaker_1',
          speakerName: '张三',
          content: '大家好,今天我们来讨论一下项目的进展情况。',
          timestamp: new Date(),
          confidence: 0.95,
          startTime: 0,
          endTime: 3.5
        },
        {
          id: 'trans_2',
          speakerId: 'speaker_2',
          speakerName: '李四',
          content: '后端API还有几个接口需要优化,预计本周完成。',
          timestamp: new Date(),
          confidence: 0.88,
          startTime: 7.0,
          endTime: 11.2
        }
      ]
      await testMeeting.save()
    })

    it('应该成功生成会议纪要', async () => {
      const response = await request(app)
        .post('/api/ai/minutes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          options: {
            language: 'zh-CN',
            includeActionItems: true,
            includeDecisions: true
          }
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('minutes')
      expect(response.body.data.minutes).toHaveProperty('title')
      expect(response.body.data.minutes).toHaveProperty('summary')
      expect(response.body.data.minutes).toHaveProperty('keyPoints')
      expect(response.body.data.minutes).toHaveProperty('actionItems')
      expect(response.body.data.minutes).toHaveProperty('decisions')
    }, 15000)

    it('应该拒绝对没有转录内容的会议生成纪要', async () => {
      // 创建一个没有转录内容的会议
      const emptyMeeting = new Meeting({
        title: 'Empty Meeting',
        host: testUser._id,
        participants: [{ userId: testUser._id, name: '测试用户', email: 'test@example.com' }],
        status: 'in_progress',
        settings: {
          enableTranscription: true,
          language: 'zh-CN'
        }
      })
      await emptyMeeting.save()

      const response = await request(app)
        .post('/api/ai/minutes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: emptyMeeting._id.toString() })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('转录内容')

      // 清理
      await Meeting.findByIdAndDelete(emptyMeeting._id)
    })
  })

  describe('POST /api/ai/minutes/optimize - 优化会议纪要', () => {
    beforeEach(async () => {
      // 设置初始纪要
      testMeeting.minutes = {
        id: 'minutes_1',
        title: '测试会议纪要',
        summary: '这是一个简单的总结',
        keyPoints: ['要点1', '要点2'],
        actionItems: [],
        decisions: [],
        generatedAt: new Date(),
        status: 'draft'
      }
      await testMeeting.save()
    })

    it('应该成功优化会议纪要', async () => {
      const response = await request(app)
        .post('/api/ai/minutes/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          feedback: '请添加更多行动项和细节'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('minutes')

      // 验证优化后的内容更丰富
      const optimizedMinutes = response.body.data.minutes
      expect(optimizedMinutes.keyPoints.length).toBeGreaterThanOrEqual(2)
      expect(optimizedMinutes.actionItems.length).toBeGreaterThan(0)
    }, 15000)

    it('应该拒绝非主持人优化纪要', async () => {
      // 创建普通参与者
      const participant = new User({
        username: 'participant1',
        email: 'participant1@example.com',
        password: 'password123',
        name: 'Participant'
      })
      await participant.save()

      const tokens = generateTokens(participant)
      const participantToken = tokens.accessToken

      // 添加为参与者但不是主持人
      testMeeting.participants.push({
        userId: participant._id,
        name: 'Participant',
        email: 'participant@example.com',
        role: 'participant'
      })
      await testMeeting.save()

      const response = await request(app)
        .post('/api/ai/minutes/optimize')
        .set('Authorization', `Bearer ${participantToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          feedback: '请添加更多细节'
        })

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)

      // 清理
      await User.findByIdAndDelete(participant._id)
    })
  })

  describe('GET /api/ai/minutes/:meetingId - 获取会议纪要', () => {
    beforeEach(async () => {
      testMeeting.minutes = {
        id: 'minutes_get_1',
        title: '获取测试纪要',
        summary: '这是用于测试获取接口的纪要',
        keyPoints: ['测试要点1', '测试要点2'],
        actionItems: [
          { description: '完成测试', assignee: '张三', priority: 'high' }
        ],
        decisions: [],
        generatedAt: new Date(),
        status: 'approved'
      }
      await testMeeting.save()
    })

    it('应该成功获取会议纪要', async () => {
      const response = await request(app)
        .get(`/api/ai/minutes/${testMeeting._id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('minutes')
      expect(response.body.data.minutes.title).toBe('获取测试纪要')
    })

    it('应该拒绝未授权用户获取纪要', async () => {
      const response = await request(app)
        .get(`/api/ai/minutes/${testMeeting._id}`)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/ai/minutes/:meetingId/approve - 批准会议纪要', () => {
    beforeEach(async () => {
      testMeeting.minutes = {
        id: 'minutes_approve_1',
        title: '待批准纪要',
        summary: '这是待批准的纪要',
        keyPoints: ['要点'],
        actionItems: [],
        decisions: [],
        generatedAt: new Date(),
        status: 'reviewing'
      }
      await testMeeting.save()
    })

    it('应该成功批准会议纪要', async () => {
      const response = await request(app)
        .post(`/api/ai/minutes/${testMeeting._id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.minutes.status).toBe('approved')

      // 验证数据库状态
      const updatedMeeting = await Meeting.findById(testMeeting._id)
      expect(updatedMeeting?.minutes?.status).toBe('approved')
    })

    it('应该拒绝非主持人批准纪要', async () => {
      const participant = new User({
        username: 'participant2',
        email: 'participant2@example.com',
        password: 'password123',
        name: 'Participant 2'
      })
      await participant.save()

      const tokens = generateTokens(participant)

      const response = await request(app)
        .post(`/api/ai/minutes/${testMeeting._id}/approve`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)

      expect(response.status).toBe(403)

      await User.findByIdAndDelete(participant._id)
    })
  })

  describe('WebSocket 实时反馈', () => {
    it('应该在纪要生成过程中发送WebSocket事件', async () => {
      const { emitToMeeting } = require('@/utils/socket')

      await request(app)
        .post('/api/ai/minutes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      // 验证WebSocket事件被触发
      expect(emitToMeeting).toHaveBeenCalled()

      // 应该发送 minutes-generated 事件
      const calls = emitToMeeting.mock.calls
      const hasMinutesGeneratedEvent = calls.some(
        call => call[1] === 'minutes-generated'
      )
      expect(hasMinutesGeneratedEvent).toBe(true)
    }, 15000)
  })

  describe('错误处理', () => {
    it('应该处理AI服务错误', async () => {
      const { aiService } = require('@/services/aiService')

      // 模拟AI服务错误
      aiService.generateMeetingMinutes.mockRejectedValueOnce(
        new Error('AI service temporarily unavailable')
      )

      const response = await request(app)
        .post('/api/ai/minutes/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('失败')

      // 恢复mock
      aiService.generateMeetingMinutes.mockResolvedValue({
        title: '测试',
        summary: '测试',
        keyPoints: [],
        actionItems: [],
        decisions: [],
        nextSteps: []
      })
    })

    it('应该处理语音识别服务错误', async () => {
      const { speechService } = require('@/services/speechRecognitionService')

      // 模拟语音识别错误
      speechService.recognizeFromFile.mockRejectedValueOnce(
        new Error('Speech recognition failed')
      )

      const response = await request(app)
        .post(`/api/meetings/${testMeeting._id}/upload-audio`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioBuffer, 'test-error.wav')

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)

      // 恢复mock
      speechService.recognizeFromFile.mockResolvedValue([
        {
          text: '测试文本',
          confidence: 0.9,
          speakerId: 'speaker_1',
          speakerName: '测试',
          startTime: 0,
          endTime: 1
        }
      ])
    })
  })
})
