import request from 'supertest'
import mongoose from 'mongoose'
import { app } from '@/tests/testApp'
import { User } from '@/models/User'
import { Meeting } from '@/models/Meeting'
import { generateTokens } from '@/middleware/auth'
import { audioService } from '@/services/audioService'
import fs from 'fs'
import path from 'path'

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

const mockLogger = require('@/utils/logger')

// Skip tests if MongoDB is not connected
const describeIfMongo = mongoose.connection.readyState === 1 ? describe : describe.skip

describeIfMongo('Recording Integration Tests', () => {
  let authToken: string
  let refreshToken: string
  let testUser: any
  let testMeeting: any
  let testAudioBuffer: Buffer

  beforeAll(async () => {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  Skipping integration tests: MongoDB is not connected')
      return
    }
    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    })
    await testUser.save()

    // Generate auth tokens
    const tokens = generateTokens(testUser)
    authToken = tokens.accessToken
    refreshToken = tokens.refreshToken

    // Create test meeting
    testMeeting = new Meeting({
      title: 'Test Meeting',
      description: 'Test meeting for recording',
      host: testUser._id,
      participants: [testUser._id],
      startTime: new Date(),
      status: 'in_progress',
      settings: {
        allowRecording: true
      }
    })
    await testMeeting.save()

    // Create test audio buffer (simulate a small WAV file)
    testAudioBuffer = Buffer.from('RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x08\x00\x00\x00\x00\x00\x00')
  })

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: 'test@example.com' })
    await Meeting.deleteMany({ host: testUser._id })

    // Clean up test files
    const testFiles = await fs.promises.readdir('./uploads').catch(() => [])
    for (const file of testFiles) {
      if (file.includes('test') || file.includes('recording')) {
        await fs.promises.unlink(`./uploads/${file}`).catch(() => {})
      }
    }
  })

  describe('Audio Upload Workflow', () => {
    it('should upload audio file successfully', async () => {
      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', testMeeting._id.toString())
        .attach('audio', testAudioBuffer, 'test-audio.wav')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('音频文件上传成功')
      expect(response.body.data).toHaveProperty('recordingId')
      expect(response.body.data).toHaveProperty('filename')
      expect(response.body.data).toHaveProperty('duration')
      expect(response.body.data).toHaveProperty('size')
      expect(response.body.data).toHaveProperty('format')

      // Verify file was saved
      const filename = response.body.data.filename
      const exists = await audioService.fileExists(filename)
      expect(exists).toBe(true)

      // Clean up
      await audioService.deleteAudioFile(filename)
    })

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', testMeeting._id.toString())

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('请选择要上传的音频文件')
    })

    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/recordings/upload')
        .field('meetingId', testMeeting._id.toString())
        .attach('audio', testAudioBuffer, 'test-audio.wav')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject upload for non-existent meeting', async () => {
      const fakeMeetingId = '507f1f77bcf86cd799439011'

      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', fakeMeetingId)
        .attach('audio', testAudioBuffer, 'test-audio.wav')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('会议不存在')
    })

    it('should reject upload for invalid audio format', async () => {
      const invalidBuffer = Buffer.from('This is not an audio file')

      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', testMeeting._id.toString())
        .attach('audio', invalidBuffer, 'test.txt')

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
    })

    it('should reject upload when recording is disabled', async () => {
      // Create meeting with recording disabled
      const noRecordingMeeting = new Meeting({
        title: 'No Recording Meeting',
        description: 'Test meeting without recording',
        host: testUser._id,
        participants: [testUser._id],
        startTime: new Date(),
        status: 'in_progress',
        settings: {
          allowRecording: false
        }
      })
      await noRecordingMeeting.save()

      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', noRecordingMeeting._id.toString())
        .attach('audio', testAudioBuffer, 'test-audio.wav')

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('无权限操作此会议')

      // Clean up
      await Meeting.findByIdAndDelete(noRecordingMeeting._id)
    })
  })

  describe('Recording Management Workflow', () => {
    let recordingId: string
    let filename: string

    beforeEach(async () => {
      // Upload a test audio file for each test
      const response = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meetingId', testMeeting._id.toString())
        .attach('audio', testAudioBuffer, 'test-audio.wav')

      recordingId = response.body.data.recordingId
      filename = response.body.data.filename
    })

    afterEach(async () => {
      // Clean up recording after each test
      if (filename && await audioService.fileExists(filename)) {
        await audioService.deleteAudioFile(filename)
      }

      // Reset meeting recording
      testMeeting.recording = undefined
      await testMeeting.save()
    })

    it('should retrieve uploaded audio file', async () => {
      const response = await request(app)
        .get(`/api/recordings/${filename}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toMatch(/audio/)
    })

    it('should reject file access without authentication', async () => {
      const response = await request(app)
        .get(`/api/recordings/${filename}`)

      expect(response.status).toBe(401)
    })

    it('should reject access to non-existent file', async () => {
      const response = await request(app)
        .get('/api/recordings/non-existent-file.wav')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('录音文件不存在')
    })

    it('should delete recording successfully', async () => {
      const response = await request(app)
        .delete(`/api/recordings/${testMeeting._id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('录音删除成功')

      // Verify file was deleted
      const exists = await audioService.fileExists(filename)
      expect(exists).toBe(false)

      // Verify meeting recording was removed
      const updatedMeeting = await Meeting.findById(testMeeting._id)
      expect(updatedMeeting?.recording).toBeUndefined()
    })

    it('should reject recording deletion by non-host', async () => {
      // Create another user
      const anotherUser = new User({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'password123',
        name: 'Another User'
      })
      await anotherUser.save()

      // Generate tokens for another user
      const otherTokens = generateTokens(anotherUser)
      const otherAuthToken = otherTokens.accessToken

      const response = await request(app)
        .delete(`/api/recordings/${testMeeting._id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('只有主持人可以删除录音')

      // Clean up
      await User.findByIdAndDelete(anotherUser._id)
    })
  })

  describe('Start/Stop Recording Workflow', () => {
    it('should start recording successfully', async () => {
      const response = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('录音开始成功')
      expect(response.body.data).toHaveProperty('recordingId')
      expect(response.body.data).toHaveProperty('filename')

      // Clean up
      const filename = response.body.data.filename
      if (filename && await audioService.fileExists(filename)) {
        await audioService.deleteAudioFile(filename)
      }
      testMeeting.recording = undefined
      await testMeeting.save()
    })

    it('should stop recording successfully', async () => {
      // First start recording
      await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      // Then stop recording
      const response = await request(app)
        .post('/api/recordings/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('录音停止成功')
      expect(response.body.data).toHaveProperty('duration')

      // Clean up
      if (testMeeting.recording?.filename) {
        await audioService.deleteAudioFile(testMeeting.recording.filename)
      }
      testMeeting.recording = undefined
      await testMeeting.save()
    })

    it('should prevent starting recording twice', async () => {
      // Start recording first time
      await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      // Try to start recording again
      const response = await request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ meetingId: testMeeting._id.toString() })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('会议正在录音中')

      // Clean up
      if (testMeeting.recording?.filename) {
        await audioService.deleteAudioFile(testMeeting.recording.filename)
      }
      testMeeting.recording = undefined
      await testMeeting.save()
    })
  })
})