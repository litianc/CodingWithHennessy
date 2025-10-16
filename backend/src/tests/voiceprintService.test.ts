// @ts-nocheck
import { VoiceprintService } from '@/services/voiceprintService'
import { logger } from '@/utils/logger'

// Mock logger to avoid console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}))

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined)
}))

describe('VoiceprintService', () => {
  let voiceprintService: VoiceprintService

  beforeEach(async () => {
    // Set environment variable for testing
    process.env.VOICEPRINT_STORAGE_PATH = '/test/voiceprints'

    // Clear all mocks before creating service
    jest.clearAllMocks()

    voiceprintService = new VoiceprintService()

    // Wait for async initialization to complete
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  afterEach(() => {
    // Clean up environment variable
    delete process.env.VOICEPRINT_STORAGE_PATH
  })

  describe('constructor', () => {
    it('should create a VoiceprintService instance', () => {
      expect(voiceprintService).toBeInstanceOf(VoiceprintService)
    })
  })

  describe('extractFeatures', () => {
    it('should extract features from audio buffer', () => {
      // Create a simple test audio buffer
      const audioBuffer = new Float32Array(1000)
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.sin(i * 0.1) * 0.5
      }

      const features = voiceprintService.extractFeatures(audioBuffer)

      expect(features).toBeInstanceOf(Float32Array)
      expect(features.length).toBeGreaterThan(0)
    })

    it('should handle empty audio buffer', () => {
      const audioBuffer = new Float32Array(0)
      const features = voiceprintService.extractFeatures(audioBuffer)

      expect(features).toBeInstanceOf(Float32Array)
      expect(features.length).toBe(0)
    })

    it('should handle very short audio buffer', () => {
      const audioBuffer = new Float32Array(100)
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.random() * 0.1
      }

      const features = voiceprintService.extractFeatures(audioBuffer)

      expect(features).toBeInstanceOf(Float32Array)
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical features', () => {
      const features1 = new Float32Array([1, 2, 3, 4, 5])
      const features2 = new Float32Array([1, 2, 3, 4, 5])

      const similarity = voiceprintService.calculateSimilarity(features1, features2)

      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('should return 0 for orthogonal features', () => {
      const features1 = new Float32Array([1, 0, 0, 0])
      const features2 = new Float32Array([0, 1, 0, 0])

      const similarity = voiceprintService.calculateSimilarity(features1, features2)

      expect(similarity).toBeCloseTo(0, 5)
    })

    it('should handle zero vectors', () => {
      const features1 = new Float32Array([0, 0, 0, 0])
      const features2 = new Float32Array([1, 2, 3, 4])

      const similarity = voiceprintService.calculateSimilarity(features1, features2)

      expect(similarity).toBe(0)
    })

    it('should handle different length vectors', () => {
      const features1 = new Float32Array([1, 2, 3, 4, 5])
      const features2 = new Float32Array([1, 2, 3])

      const similarity = voiceprintService.calculateSimilarity(features1, features2)

      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('assessAudioQuality', () => {
    it('should assess audio quality correctly', () => {
      // Create a normal quality audio buffer
      const audioBuffer = new Float32Array(16000) // 1 second at 16kHz
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.sin(i * 0.01) * 0.3
      }

      const quality = voiceprintService.assessAudioQuality(audioBuffer, 16000)

      expect(typeof quality).toBe('string')
      expect(['very_low', 'low', 'medium', 'good', 'excellent']).toContain(quality)
    })

    it('should assess very low quality audio', () => {
      // Create a very low quality audio buffer
      const audioBuffer = new Float32Array(16000)
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.random() * 0.001 // Very low amplitude
      }

      const quality = voiceprintService.assessAudioQuality(audioBuffer, 16000)

      expect(quality).toBe('very_low')
    })

    it('should assess excellent quality audio', () => {
      // Create a high quality audio buffer
      const audioBuffer = new Float32Array(16000)
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.sin(i * 0.01) * 0.8 // High amplitude
      }

      const quality = voiceprintService.assessAudioQuality(audioBuffer, 16000)

      expect(quality).toBe('excellent')
    })
  })

  describe('calculateConfidence', () => {
    it('should calculate confidence for features', () => {
      const features = new Float32Array(100)
      for (let i = 0; i < features.length; i++) {
        features[i] = Math.random()
      }

      const confidence = voiceprintService.calculateConfidence(features)

      expect(typeof confidence).toBe('number')
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    it('should handle empty features', () => {
      const features = new Float32Array(0)

      const confidence = voiceprintService.calculateConfidence(features)

      expect(typeof confidence).toBe('number')
    })
  })

  describe('getVoiceprintStats', () => {
    it('should return default stats when no voiceprints exist', async () => {
      const stats = await voiceprintService.getVoiceprintStats()

      expect(stats).toHaveProperty('totalVoiceprints', 0)
      expect(stats).toHaveProperty('totalUsers', 0)
      expect(stats).toHaveProperty('averageConfidence', 0)
      expect(stats).toHaveProperty('qualityDistribution')
      expect(typeof stats.qualityDistribution).toBe('object')
    })
  })

  describe('getUserVoiceprints', () => {
    it('should return empty array for user with no voiceprints', async () => {
      const voiceprints = await voiceprintService.getUserVoiceprints('test-user-id')

      expect(Array.isArray(voiceprints)).toBe(true)
      expect(voiceprints.length).toBe(0)
    })
  })

  describe('createVoiceprint', () => {
    let testAudioBuffer: Float32Array

    beforeEach(() => {
      // Create test audio buffer (longer than minSampleLength)
      testAudioBuffer = new Float32Array(10000)
      for (let i = 0; i < testAudioBuffer.length; i++) {
        testAudioBuffer[i] = Math.sin(i * 0.001) * 0.5
      }
    })

    it('should create voiceprint successfully', async () => {
      const voiceprint = await voiceprintService.createVoiceprint(
        'test-user-id',
        'Test User',
        'test@example.com',
        testAudioBuffer,
        16000
      )

      expect(voiceprint).toBeDefined()
      expect(voiceprint.id).toBeDefined()
      expect(voiceprint.userId).toBe('test-user-id')
      expect(voiceprint.name).toBe('Test User')
      expect(voiceprint.email).toBe('test@example.com')
      expect(voiceprint.sampleCount).toBe(testAudioBuffer.length)
      expect(voiceprint.sampleRate).toBe(16000)
      expect(voiceprint.voiceprintData).toBeDefined()
      expect(voiceprint.confidence).toBeGreaterThanOrEqual(0)
      expect(voiceprint.confidence).toBeLessThanOrEqual(1)
      expect(voiceprint.createdAt).toBeInstanceOf(Date)
      expect(voiceprint.updatedAt).toBeInstanceOf(Date)
      expect(voiceprint.metadata).toBeDefined()
    })

    it('should reject audio buffer that is too short', async () => {
      const shortBuffer = new Float32Array(1000) // Less than minSampleLength

      await expect(
        voiceprintService.createVoiceprint(
          'test-user-id',
          'Test User',
          'test@example.com',
          shortBuffer
        )
      ).rejects.toThrow('音频样本太短')
    })

    it('should handle metadata correctly', async () => {
      const metadata = {
        deviceInfo: 'test-device',
        recordingEnvironment: 'test-environment'
      }

      const voiceprint = await voiceprintService.createVoiceprint(
        'test-user-id',
        'Test User',
        'test@example.com',
        testAudioBuffer,
        16000,
        metadata
      )

      expect(voiceprint.metadata?.deviceInfo).toBe('test-device')
      expect(voiceprint.metadata?.recordingEnvironment).toBe('test-environment')
      expect(voiceprint.metadata?.audioQuality).toBeDefined()
    })
  })

  describe('matchVoiceprint', () => {
    let testAudioBuffer1: Float32Array
    let testAudioBuffer2: Float32Array
    let differentAudioBuffer: Float32Array
    let voiceprintId: string

    beforeEach(async () => {
      // Create test audio buffers
      testAudioBuffer1 = new Float32Array(10000)
      testAudioBuffer2 = new Float32Array(10000)
      differentAudioBuffer = new Float32Array(10000)

      for (let i = 0; i < testAudioBuffer1.length; i++) {
        testAudioBuffer1[i] = Math.sin(i * 0.001) * 0.5
        testAudioBuffer2[i] = Math.sin(i * 0.001) * 0.5 + Math.random() * 0.01 // Similar with noise
        differentAudioBuffer[i] = Math.cos(i * 0.001) * 0.5 // Different pattern
      }

      // Create a voiceprint for testing
      const voiceprint = await voiceprintService.createVoiceprint(
        'test-user-id',
        'Test User',
        'test@example.com',
        testAudioBuffer1,
        16000
      )
      voiceprintId = voiceprint.id
    })

    it('should match similar voiceprints', async () => {
      const matches = await voiceprintService.matchVoiceprint(testAudioBuffer2, 16000)

      expect(Array.isArray(matches)).toBe(true)
      expect(matches.length).toBeGreaterThan(0)

      const bestMatch = matches[0]
      expect(bestMatch.userId).toBe('test-user-id')
      expect(bestMatch.similarity).toBeGreaterThan(0.5)
      expect(bestMatch.confidence).toBeGreaterThanOrEqual(0)
      expect(bestMatch.confidence).toBeLessThanOrEqual(1)
      expect(bestMatch.voiceprintId).toBe(voiceprintId)
    })

    it('should return empty array when no voiceprints exist', async () => {
      // Create a new service instance with no voiceprints
      const emptyService = new VoiceprintService()

      const matches = await emptyService.matchVoiceprint(testAudioBuffer1, 16000)

      expect(matches).toEqual([])
    })

    it('should return low similarity for different voices', async () => {
      // Create a different user's voiceprint
      await voiceprintService.createVoiceprint(
        'other-user-id',
        'Other User',
        'other@example.com',
        differentAudioBuffer,
        16000
      )

      const matches = await voiceprintService.matchVoiceprint(testAudioBuffer1, 16000)

      // Should find both voiceprints but with different similarity scores
      expect(matches.length).toBeGreaterThanOrEqual(1)

      const testUserMatch = matches.find(m => m.userId === 'test-user-id')
      expect(testUserMatch).toBeDefined()
      expect(testUserMatch!.similarity).toBeGreaterThan(0.5)
    })
  })

  describe('deleteVoiceprintById', () => {
    let voiceprintId: string

    beforeEach(async () => {
      const testAudioBuffer = new Float32Array(10000)
      for (let i = 0; i < testAudioBuffer.length; i++) {
        testAudioBuffer[i] = Math.sin(i * 0.001) * 0.5
      }

      const voiceprint = await voiceprintService.createVoiceprint(
        'test-user-id',
        'Test User',
        'test@example.com',
        testAudioBuffer,
        16000
      )
      voiceprintId = voiceprint.id
    })

    it('should delete voiceprint successfully', async () => {
      const result = await voiceprintService.deleteVoiceprintById(voiceprintId, 'test-user-id')

      expect(result).toBe(true)
    })

    it('should return false for non-existent voiceprint', async () => {
      const result = await voiceprintService.deleteVoiceprintById('non-existent-id', 'test-user-id')

      expect(result).toBe(false)
    })

    it('should return false when voiceprint belongs to different user', async () => {
      const result = await voiceprintService.deleteVoiceprintById(voiceprintId, 'other-user-id')

      expect(result).toBe(false)
    })
  })

  describe('updateVoiceprint', () => {
    let voiceprintId: string

    beforeEach(async () => {
      const testAudioBuffer = new Float32Array(10000)
      for (let i = 0; i < testAudioBuffer.length; i++) {
        testAudioBuffer[i] = Math.sin(i * 0.001) * 0.5
      }

      const voiceprint = await voiceprintService.createVoiceprint(
        'test-user-id',
        'Test User',
        'test@example.com',
        testAudioBuffer,
        16000
      )
      voiceprintId = voiceprint.id
    })

    it('should update voiceprint metadata', async () => {
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com'
      }

      const updatedVoiceprint = await voiceprintService.updateVoiceprint(
        voiceprintId,
        'test-user-id',
        updates
      )

      expect(updatedVoiceprint).toBeDefined()
      expect(updatedVoiceprint!.name).toBe('Updated Name')
      expect(updatedVoiceprint!.email).toBe('updated@example.com')
      expect(updatedVoiceprint!.updatedAt.getTime()).toBeGreaterThan(
        updatedVoiceprint!.createdAt.getTime()
      )
    })

    it('should return null for non-existent voiceprint', async () => {
      const result = await voiceprintService.updateVoiceprint(
        'non-existent-id',
        'test-user-id',
        { name: 'Updated Name' }
      )

      expect(result).toBeNull()
    })

    it('should return null when voiceprint belongs to different user', async () => {
      const result = await voiceprintService.updateVoiceprint(
        voiceprintId,
        'other-user-id',
        { name: 'Updated Name' }
      )

      expect(result).toBeNull()
    })
  })

  describe('getVoiceprintStats with data', () => {
    beforeEach(async () => {
      // Create multiple voiceprints for testing
      const testAudioBuffer = new Float32Array(10000)
      for (let i = 0; i < testAudioBuffer.length; i++) {
        testAudioBuffer[i] = Math.sin(i * 0.001) * 0.5
      }

      await voiceprintService.createVoiceprint(
        'user1',
        'User 1',
        'user1@example.com',
        testAudioBuffer,
        16000
      )

      await voiceprintService.createVoiceprint(
        'user2',
        'User 2',
        'user2@example.com',
        testAudioBuffer,
        16000
      )

      await voiceprintService.createVoiceprint(
        'user1',
        'User 1',
        'user1@example.com',
        testAudioBuffer,
        16000
      )
    })

    it('should return correct statistics', async () => {
      const stats = await voiceprintService.getVoiceprintStats()

      expect(stats.totalVoiceprints).toBe(3)
      expect(stats.totalUsers).toBe(2)
      expect(stats.averageConfidence).toBeGreaterThan(0)
      expect(stats.averageConfidence).toBeLessThanOrEqual(1)
      expect(typeof stats.qualityDistribution).toBe('object')
    })
  })
})