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

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn()
  }
}))

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}))

describe('VoiceprintService', () => {
  let voiceprintService: VoiceprintService

  beforeEach(() => {
    // Set environment variable for testing
    process.env.VOICEPRINT_STORAGE_PATH = '/test/voiceprints'

    voiceprintService = new VoiceprintService()

    // Clear all mocks
    jest.clearAllMocks()
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
})