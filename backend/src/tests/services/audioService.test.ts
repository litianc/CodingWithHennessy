import { AudioService } from '@/services/audioService'
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

const mockLogger = require('@/utils/logger')

// Mock ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockCommand = {
    on: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    seekInput: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    audioFilters: jest.fn().mockReturnThis(),
    mergeToFile: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnThis(),
    input: jest.fn().mockReturnThis()
  }

  const mockFfmpeg = jest.fn((inputPath?: string) => mockCommand)
  ;(mockFfmpeg as any).ffprobe = jest.fn()

  return mockFfmpeg
})

describe('AudioService', () => {
  let audioService: AudioService
  const testUploadDir = './test-uploads'

  beforeEach(() => {
    audioService = new AudioService()
    // 创建测试目录
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true })
    }
  })

  afterEach(() => {
    // 清理测试文件和目录
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true })
    }
  })

  describe('saveAudioFile', () => {
    it('should save audio file successfully', async () => {
      const audioBuffer = Buffer.from('fake audio data')
      const originalName = 'test.wav'

      const filename = await audioService.saveAudioFile(audioBuffer, originalName)

      expect(filename).toMatch(/^[a-f0-9-]{36}\.wav$/)
      expect(fs.existsSync(path.join(audioService['uploadDir'], filename))).toBe(true)
    })

    it('should handle empty buffer', async () => {
      const audioBuffer = Buffer.alloc(0)
      const originalName = 'empty.wav'

      const filename = await audioService.saveAudioFile(audioBuffer, originalName)

      expect(filename).toBeDefined()
      expect(fs.existsSync(path.join(audioService['uploadDir'], filename))).toBe(true)
    })
  })

  describe('getAudioMetadata', () => {
    it('should extract audio metadata successfully', async () => {
      const mockMetadata = {
        streams: [{
          codec_type: 'audio',
          sample_rate: 44100,
          channels: 2
        }],
        format: {
          duration: 120.5,
          bit_rate: 320000,
          format_name: 'wav',
          size: 1024000
        }
      }

      const ffmpeg = require('fluent-ffmpeg')
      ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
        callback(null, mockMetadata)
      })

      const filePath = '/test/audio.wav'
      const metadata = await audioService.getAudioMetadata(filePath)

      expect(metadata).toEqual({
        duration: 120.5,
        bitrate: 320000,
        sampleRate: 44100,
        channels: 2,
        format: 'wav',
        size: 1024000
      })
    })

    it('should handle audio stream not found error', async () => {
      const ffmpeg = require('fluent-ffmpeg')
      ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
        callback(new Error('No audio stream found'), null)
      })

      const filePath = '/test/no-audio.wav'

      await expect(audioService.getAudioMetadata(filePath)).rejects.toThrow('获取音频元数据失败')
    })
  })

  describe('convertAudio', () => {
    it('should convert audio format successfully', async () => {
      // Setup successful conversion simulation
      const mockCommand = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(callback, 100)
          }
          return mockCommand
        }),
        audioFrequency: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnThis(),
        output: jest.fn().mockReturnThis(),
        run: jest.fn()
      }

      const ffmpeg = require('fluent-ffmpeg')
      ffmpeg.mockReturnValue(mockCommand)

      const inputPath = '/test/input.mp3'
      const outputPath = '/test/output.wav'
      const options = { sampleRate: 16000, channels: 1 }

      await expect(audioService.convertAudio(inputPath, outputPath, options)).resolves.toBeUndefined()
    })

    it('should use default options when none provided', async () => {
      const mockCommand = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(callback, 100)
          }
          return mockCommand
        }),
        audioFrequency: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnThis(),
        output: jest.fn().mockReturnThis(),
        run: jest.fn()
      }

      const ffmpeg = require('fluent-ffmpeg')
      ffmpeg.mockReturnValue(mockCommand)

      const inputPath = '/test/input.mp3'
      const outputPath = '/test/output.wav'

      await expect(audioService.convertAudio(inputPath, outputPath)).resolves.toBeUndefined()
    })
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filename = 'test.wav'
      const filePath = path.join(audioService['uploadDir'], filename)

      // Create a test file
      fs.writeFileSync(filePath, 'test content')

      const exists = await audioService.fileExists(filename)
      expect(exists).toBe(true)
    })

    it('should return false for non-existing file', async () => {
      const filename = 'nonexistent.wav'

      const exists = await audioService.fileExists(filename)
      expect(exists).toBe(false)
    })
  })

  describe('getFileSize', () => {
    it('should return correct file size', async () => {
      const filename = 'test.wav'
      const filePath = path.join(audioService['uploadDir'], filename)
      const content = 'test audio content'

      fs.writeFileSync(filePath, content)

      const size = await audioService.getFileSize(filename)
      expect(size).toBe(content.length)
    })

    it('should return 0 for non-existing file', async () => {
      const filename = 'nonexistent.wav'

      const size = await audioService.getFileSize(filename)
      expect(size).toBe(0)
    })
  })

  describe('deleteAudioFile', () => {
    it('should delete existing file successfully', async () => {
      const filename = 'test.wav'
      const filePath = path.join(audioService['uploadDir'], filename)

      fs.writeFileSync(filePath, 'test content')

      await expect(audioService.deleteAudioFile(filename)).resolves.toBeUndefined()
      expect(fs.existsSync(filePath)).toBe(false)
    })

    it('should handle non-existing file gracefully', async () => {
      const filename = 'nonexistent.wav'

      await expect(audioService.deleteAudioFile(filename)).rejects.toThrow('删除音频文件失败')
    })
  })

  describe('cleanupTempFiles', () => {
    it('should clean up old temp files', async () => {
      const oldFilePath = path.join(audioService['tempDir'], 'old-file.tmp')
      const recentFilePath = path.join(audioService['tempDir'], 'recent-file.tmp')

      // Create files with different timestamps
      fs.writeFileSync(oldFilePath, 'old content')
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      await fs.promises.utimes(oldFilePath, oldTime, oldTime)

      fs.writeFileSync(recentFilePath, 'recent content')
      const recentTime = new Date() // current time
      await fs.promises.utimes(recentFilePath, recentTime, recentTime)

      await audioService.cleanupTempFiles()

      expect(fs.existsSync(oldFilePath)).toBe(false)
      expect(fs.existsSync(recentFilePath)).toBe(true)
    })
  })
})