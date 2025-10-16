import request from 'supertest'
import mongoose from 'mongoose'
import { app } from '@/tests/testApp'
import { User } from '@/models/User'
import { Meeting } from '@/models/Meeting'
import { generateTokens } from '@/middleware/auth'
import { audioService } from '@/services/audioService'
import fs from 'fs'

// Mock logger to avoid actual logging during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  },
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logHttp: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  }
}))

// Mock Socket.IO
jest.mock('@/utils/socket', () => ({
  emitToMeeting: jest.fn()
}))

// Mock AI Service
jest.mock('@/services/aiService', () => ({
  aiService: {
    generateMeetingMinutes: jest.fn().mockResolvedValue({
      title: '会议纪要',
      date: new Date().toISOString(),
      participants: ['测试用户'],
      summary: '这是一个测试会议',
      keyPoints: ['讨论了项目进度', '确定了下一步计划'],
      actionItems: [{ task: '完成文档', assignee: '测试用户', deadline: '2025-01-20' }],
      decisions: ['继续按计划推进']
    }),
    optimizeMeetingMinutes: jest.fn().mockResolvedValue({
      title: '优化后的会议纪要',
      date: new Date().toISOString(),
      participants: ['测试用户'],
      summary: '这是一个优化后的测试会议',
      keyPoints: ['讨论了项目进度', '确定了下一步计划', '制定了时间表'],
      actionItems: [{ task: '完成文档', assignee: '测试用户', deadline: '2025-01-20' }],
      decisions: ['继续按计划推进', '每周进行进度回顾']
    }),
    chatCompletion: jest.fn().mockResolvedValue({
      content: '这是AI的回复'
    })
  }
}))

// Skip tests if MongoDB is not connected
const describeIfMongo = mongoose.connection.readyState === 1 ? describe : describe.skip

describeIfMongo('End-to-End Workflow Tests', () => {
  let authToken: string
  let testUser: any
  let testMeeting: any
  let testAudioBuffer: Buffer

  beforeAll(async () => {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  Skipping E2E tests: MongoDB is not connected')
      return
    }

    // Create test user
    testUser = new User({
      username: 'e2e-testuser',
      email: 'e2e-test@example.com',
      password: 'password123',
      name: 'E2E Test User'
    })
    await testUser.save()

    // Generate auth tokens
    const tokens = generateTokens(testUser)
    authToken = tokens.accessToken

    // Create test meeting
    testMeeting = new Meeting({
      title: 'E2E Test Meeting',
      description: 'End-to-end test meeting',
      host: testUser._id,
      participants: [testUser._id],
      startTime: new Date(),
      status: 'in_progress',
      settings: {
        allowRecording: true,
        enableTranscription: true,
        enableVoiceprint: true
      }
    })
    await testMeeting.save()

    // Create test audio buffer (simulate a small WAV file)
    testAudioBuffer = Buffer.from(
      'RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x08\x00\x00\x00\x00\x00\x00'
    )
  })

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await User.deleteMany({ email: 'e2e-test@example.com' })
    }
    if (testMeeting) {
      await Meeting.deleteMany({ host: testUser._id })
    }

    // Clean up test files
    const testFiles = await fs.promises.readdir('./uploads').catch(() => [])
    for (const file of testFiles) {
      if (file.includes('e2e-test') || file.includes('recording')) {
        await fs.promises.unlink(`./uploads/${file}`).catch(() => {})
      }
    }
  })

  describe('Complete Meeting Workflow', () => {
    it('should complete full workflow: start recording → upload audio → generate minutes → AI optimization', async () => {
      // Step 1: Start recording
      const startRecordingResponse = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(startRecordingResponse.status).toBe(200)
      expect(startRecordingResponse.body.success).toBe(true)
      expect(startRecordingResponse.body.data).toHaveProperty('recordingId')

      const recordingFilename = startRecordingResponse.body.data.filename

      // Step 2: Upload audio file
      const uploadResponse = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', testMeeting._id.toString())
        .attach('audio', testAudioBuffer, 'e2e-test-audio.wav')

      expect(uploadResponse.status).toBe(200)
      expect(uploadResponse.body.success).toBe(true)
      expect(uploadResponse.body.data).toHaveProperty('recordingId')

      // Step 3: Stop recording
      const stopRecordingResponse = await request(app)
        .post('/api/recordings/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(stopRecordingResponse.status).toBe(200)
      expect(stopRecordingResponse.body.success).toBe(true)

      // Step 4: Generate meeting minutes using AI
      const generateMinutesResponse = await request(app)
        .post('/api/ai/generate-minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          transcription: '这是测试转录文本。我们讨论了项目进度和下一步计划。'
        })

      expect(generateMinutesResponse.status).toBe(200)
      expect(generateMinutesResponse.body.success).toBe(true)
      expect(generateMinutesResponse.body.data).toHaveProperty('title')
      expect(generateMinutesResponse.body.data).toHaveProperty('summary')
      expect(generateMinutesResponse.body.data).toHaveProperty('keyPoints')

      const generatedMinutes = generateMinutesResponse.body.data

      // Step 5: Optimize meeting minutes with AI
      const optimizeMinutesResponse = await request(app)
        .post('/api/ai/optimize-minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          minutes: generatedMinutes,
          instructions: '请添加更多细节和行动项'
        })

      expect(optimizeMinutesResponse.status).toBe(200)
      expect(optimizeMinutesResponse.body.success).toBe(true)
      expect(optimizeMinutesResponse.body.data).toHaveProperty('title')
      expect(optimizeMinutesResponse.body.data).toHaveProperty('summary')

      // Step 6: Update meeting with final minutes
      const updatedMeeting = await Meeting.findById(testMeeting._id)
      expect(updatedMeeting).toBeDefined()

      // Cleanup
      if (recordingFilename && (await audioService.fileExists(recordingFilename))) {
        await audioService.deleteAudioFile(recordingFilename)
      }
      if (uploadResponse.body.data?.filename && (await audioService.fileExists(uploadResponse.body.data.filename))) {
        await audioService.deleteAudioFile(uploadResponse.body.data.filename)
      }
    }, 60000)
  })

  describe('Meeting Lifecycle with Participants', () => {
    let participant2: any
    let participant2Token: string

    beforeAll(async () => {
      // Create second participant
      participant2 = new User({
        username: 'e2e-participant2',
        email: 'e2e-participant2@example.com',
        password: 'password123',
        name: 'Participant 2'
      })
      await participant2.save()

      const tokens = generateTokens(participant2)
      participant2Token = tokens.accessToken
    })

    afterAll(async () => {
      if (participant2) {
        await User.deleteMany({ email: 'e2e-participant2@example.com' })
      }
    })

    it('should handle multi-participant meeting workflow', async () => {
      // Create a new meeting with multiple participants
      const multiParticipantMeeting = new Meeting({
        title: 'Multi-Participant Test Meeting',
        description: 'Meeting with multiple participants',
        host: testUser._id,
        participants: [testUser._id, participant2._id],
        startTime: new Date(),
        status: 'scheduled',
        settings: {
          allowRecording: true,
          enableTranscription: true
        }
      })
      await multiParticipantMeeting.save()

      // Step 1: Host starts the meeting
      const startMeetingResponse = await request(app)
        .patch(`/api/meetings/${multiParticipantMeeting._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(startMeetingResponse.status).toBe(200)
      expect(startMeetingResponse.body.data.status).toBe('in_progress')

      // Step 2: Start recording
      const recordingResponse = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: multiParticipantMeeting._id.toString() })

      expect(recordingResponse.status).toBe(200)

      // Step 3: Participant joins (this would be via WebSocket in real app)
      // For now we just verify they can access the meeting
      const getMeetingResponse = await request(app)
        .get(`/api/meetings/${multiParticipantMeeting._id}`)
        .set('Authorization', `Bearer ${participant2Token}`)

      expect(getMeetingResponse.status).toBe(200)
      expect(getMeetingResponse.body.data.title).toBe('Multi-Participant Test Meeting')

      // Step 4: Stop recording and end meeting
      await request(app)
        .post('/api/recordings/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: multiParticipantMeeting._id.toString() })

      const endMeetingResponse = await request(app)
        .patch(`/api/meetings/${multiParticipantMeeting._id}/end`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(endMeetingResponse.status).toBe(200)
      expect(endMeetingResponse.body.data.status).toBe('completed')

      // Cleanup
      await Meeting.findByIdAndDelete(multiParticipantMeeting._id)
      if (recordingResponse.body.data?.filename) {
        const filename = recordingResponse.body.data.filename
        if (await audioService.fileExists(filename)) {
          await audioService.deleteAudioFile(filename)
        }
      }
    }, 45000)
  })

  describe('AI Chat Interaction Workflow', () => {
    it('should handle AI chat for minutes optimization', async () => {
      const testMinutes = {
        title: '测试会议纪要',
        date: new Date().toISOString(),
        participants: ['测试用户'],
        summary: '这是一个简单的总结',
        keyPoints: ['要点1', '要点2'],
        actionItems: [],
        decisions: []
      }

      // Step 1: Start AI chat session
      const chatResponse1 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          message: '请帮我优化这份会议纪要',
          context: { minutes: testMinutes }
        })

      expect(chatResponse1.status).toBe(200)
      expect(chatResponse1.body.success).toBe(true)
      expect(chatResponse1.body.data).toHaveProperty('content')

      // Step 2: Follow-up question
      const chatResponse2 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          message: '能否添加更多行动项？',
          context: { minutes: testMinutes }
        })

      expect(chatResponse2.status).toBe(200)
      expect(chatResponse2.body.success).toBe(true)
    }, 30000)
  })

  describe('Error Handling in Workflow', () => {
    it('should handle recording errors gracefully', async () => {
      // Try to start recording for non-existent meeting
      const invalidResponse = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: '507f1f77bcf86cd799439011' })

      expect(invalidResponse.status).toBe(404)
      expect(invalidResponse.body.success).toBe(false)
    })

    it('should prevent unauthorized access to meeting operations', async () => {
      // Create another user
      const unauthorizedUser = new User({
        username: 'unauthorized-user',
        email: 'unauthorized@example.com',
        password: 'password123',
        name: 'Unauthorized User'
      })
      await unauthorizedUser.save()

      const tokens = generateTokens(unauthorizedUser)
      const unauthorizedToken = tokens.accessToken

      // Try to start recording for someone else's meeting
      const unauthorizedResponse = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(unauthorizedResponse.status).toBe(403)
      expect(unauthorizedResponse.body.success).toBe(false)

      // Cleanup
      await User.findByIdAndDelete(unauthorizedUser._id)
    })

    it('should handle AI service errors gracefully', async () => {
      // Mock AI service to throw error
      const { aiService } = require('@/services/aiService')
      aiService.generateMeetingMinutes.mockRejectedValueOnce(new Error('AI service error'))

      const errorResponse = await request(app)
        .post('/api/ai/generate-minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          meetingId: testMeeting._id.toString(),
          transcription: '测试文本'
        })

      expect(errorResponse.status).toBe(500)
      expect(errorResponse.body.success).toBe(false)

      // Restore mock
      aiService.generateMeetingMinutes.mockResolvedValue({
        title: '会议纪要',
        summary: '总结',
        keyPoints: []
      })
    })
  })
})
