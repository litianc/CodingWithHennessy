// @ts-nocheck
/**
 * 会议纪要生成服务单元测试
 * 测试MinutesGenerationService的核心业务逻辑
 */

import { MinutesGenerationService } from '@/services/minutesGenerationService'
import { audioService } from '@/services/audioService'
import { speechService } from '@/services/speechRecognitionService'
import { aiService } from '@/services/aiService'
import { voiceprintService } from '@/services/voiceprintService'
import { Meeting } from '@/models/Meeting'

// Mock所有依赖服务
jest.mock('@/services/audioService', () => ({
  audioService: {
    getAudioMetadata: jest.fn(),
    convertAudio: jest.fn(),
    createTempFilePath: jest.fn(),
    saveAudioFile: jest.fn(),
    deleteAudioFile: jest.fn(),
    fileExists: jest.fn()
  }
}))

jest.mock('@/services/speechRecognitionService', () => ({
  speechService: {
    recognizeFromFile: jest.fn()
  }
}))

jest.mock('@/services/aiService', () => ({
  aiService: {
    generateMeetingMinutes: jest.fn(),
    optimizeMeetingMinutes: jest.fn()
  }
}))

jest.mock('@/services/voiceprintService', () => ({
  voiceprintService: {
    identifySpeakers: jest.fn()
  }
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}))

jest.mock('@/utils/socket', () => ({
  getSocketIO: jest.fn(),
  emitToMeeting: jest.fn()
}))

describe('MinutesGenerationService', () => {
  let service: MinutesGenerationService
  let mockMeeting: any

  beforeEach(() => {
    service = new MinutesGenerationService()

    // 模拟Meeting对象
    mockMeeting = {
      _id: 'meeting123',
      title: '测试会议',
      host: 'user123',
      participants: [
        { userId: 'user123', name: '张三', email: 'zhangsan@example.com' }
      ],
      status: 'in_progress',
      settings: {
        enableTranscription: true,
        enableVoiceprint: true,
        autoGenerateMinutes: true,
        language: 'zh-CN'
      },
      transcriptions: [],
      addTranscription: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
    }

    // 重置所有mocks
    jest.clearAllMocks()
  })

  describe('processAudioFile - 处理音频文件', () => {
    const mockAudioPath = '/uploads/test-audio.wav'
    const mockConvertedPath = '/uploads/test-audio-converted.wav'

    beforeEach(() => {
      // Mock音频服务
      ;(audioService.getAudioMetadata as jest.Mock).mockResolvedValue({
        duration: 120,
        bitrate: 128000,
        sampleRate: 44100,
        channels: 2,
        format: 'mp3',
        size: 1024000
      })

      ;(audioService.convertAudio as jest.Mock).mockResolvedValue(undefined)
      ;(audioService.createTempFilePath as jest.Mock).mockReturnValue(mockConvertedPath)

      // Mock语音识别服务
      ;(speechService.recognizeFromFile as jest.Mock).mockResolvedValue([
        {
          text: '大家好,今天讨论项目进展。',
          confidence: 0.95,
          speakerId: 'speaker_1',
          speakerName: '',
          startTime: 0,
          endTime: 3.5
        },
        {
          text: '前端已完成80%。',
          confidence: 0.92,
          speakerId: 'speaker_1',
          speakerName: '',
          startTime: 3.5,
          endTime: 6.0
        }
      ])

      // Mock声纹识别服务
      ;(voiceprintService.identifySpeakers as jest.Mock).mockResolvedValue([
        { speakerId: 'speaker_1', name: '张三', email: 'zhangsan@example.com', confidence: 0.95 }
      ])
    })

    it('应该成功处理音频文件并返回转录结果', async () => {
      const result = await service.processAudioFile(mockAudioPath, mockMeeting)

      expect(result).toBeDefined()
      expect(result.transcriptions).toBeInstanceOf(Array)
      expect(result.transcriptions.length).toBe(2)
      expect(result.audioMetadata).toHaveProperty('duration')
      expect(result.convertedAudioPath).toBe(mockConvertedPath)

      // 验证服务调用
      expect(audioService.getAudioMetadata).toHaveBeenCalledWith(mockAudioPath)
      expect(audioService.convertAudio).toHaveBeenCalled()
      expect(speechService.recognizeFromFile).toHaveBeenCalledWith(
        mockConvertedPath,
        expect.objectContaining({
          language: 'zh-CN',
          enableSpeakerDiarization: true
        })
      )
    })

    it('应该在启用声纹识别时识别发言人', async () => {
      const result = await service.processAudioFile(mockAudioPath, mockMeeting)

      expect(voiceprintService.identifySpeakers).toHaveBeenCalled()
      expect(result.transcriptions[0].speakerName).toBe('张三')
      expect(result.speakers).toBeInstanceOf(Array)
      expect(result.speakers?.length).toBe(1)
    })

    it('应该在未启用声纹识别时跳过发言人识别', async () => {
      mockMeeting.settings.enableVoiceprint = false

      const result = await service.processAudioFile(mockAudioPath, mockMeeting)

      expect(voiceprintService.identifySpeakers).not.toHaveBeenCalled()
      expect(result.speakers).toBeUndefined()
    })

    it('应该处理音频格式已经正确的情况', async () => {
      ;(audioService.getAudioMetadata as jest.Mock).mockResolvedValue({
        duration: 120,
        sampleRate: 16000, // 已经是16kHz
        channels: 1, // 已经是单声道
        format: 'wav'
      })

      const result = await service.processAudioFile(mockAudioPath, mockMeeting)

      // 应该跳过格式转换
      expect(audioService.convertAudio).not.toHaveBeenCalled()
      expect(result.convertedAudioPath).toBeUndefined()
    })

    it('应该在语音识别失败时抛出错误', async () => {
      ;(speechService.recognizeFromFile as jest.Mock).mockRejectedValue(
        new Error('Speech recognition failed')
      )

      await expect(service.processAudioFile(mockAudioPath, mockMeeting))
        .rejects.toThrow('语音识别失败')
    })

    it('应该处理空的转录结果', async () => {
      ;(speechService.recognizeFromFile as jest.Mock).mockResolvedValue([])

      const result = await service.processAudioFile(mockAudioPath, mockMeeting)

      expect(result.transcriptions).toEqual([])
    })
  })

  describe('generateMinutes - 生成会议纪要', () => {
    const mockTranscriptions = [
      {
        id: 'trans_1',
        speakerId: 'speaker_1',
        speakerName: '张三',
        content: '大家好,今天讨论项目进展。',
        timestamp: new Date(),
        confidence: 0.95,
        startTime: 0,
        endTime: 3.5
      },
      {
        id: 'trans_2',
        speakerId: 'speaker_2',
        speakerName: '李四',
        content: '前端已完成80%,后端进行中。',
        timestamp: new Date(),
        confidence: 0.92,
        startTime: 3.5,
        endTime: 7.0
      }
    ]

    beforeEach(() => {
      mockMeeting.transcriptions = mockTranscriptions

      ;(aiService.generateMeetingMinutes as jest.Mock).mockResolvedValue({
        title: '项目进展讨论会议',
        summary: '团队讨论了项目进展情况',
        keyPoints: ['前端完成80%', '后端开发中'],
        actionItems: [
          { description: '完成前端剩余20%', assignee: '张三', priority: 'high' },
          { description: '完成后端API', assignee: '李四', priority: 'high' }
        ],
        decisions: [
          { description: '确定下周目标', decisionMaker: '项目经理', context: '进度讨论' }
        ],
        nextSteps: ['张三完成前端', '李四完成后端']
      })
    })

    it('应该成功生成会议纪要', async () => {
      const result = await service.generateMinutes(mockMeeting)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('keyPoints')
      expect(result).toHaveProperty('actionItems')
      expect(result).toHaveProperty('decisions')

      // 验证AI服务被正确调用
      expect(aiService.generateMeetingMinutes).toHaveBeenCalledWith(
        expect.stringContaining('张三'),
        expect.objectContaining({
          title: '测试会议',
          language: 'zh-CN'
        })
      )
    })

    it('应该在没有转录内容时抛出错误', async () => {
      mockMeeting.transcriptions = []

      await expect(service.generateMinutes(mockMeeting))
        .rejects.toThrow('转录内容')
    })

    it('应该正确构建转录文本', async () => {
      await service.generateMinutes(mockMeeting)

      const callArgs = (aiService.generateMeetingMinutes as jest.Mock).mock.calls[0]
      const transcriptionText = callArgs[0]

      expect(transcriptionText).toContain('[张三]')
      expect(transcriptionText).toContain('[李四]')
      expect(transcriptionText).toContain('大家好,今天讨论项目进展')
      expect(transcriptionText).toContain('前端已完成80%,后端进行中')
    })

    it('应该使用会议设置的语言', async () => {
      mockMeeting.settings.language = 'en-US'

      await service.generateMinutes(mockMeeting)

      const callArgs = (aiService.generateMeetingMinutes as jest.Mock).mock.calls[0]
      const options = callArgs[1]

      expect(options.language).toBe('en-US')
    })

    it('应该处理AI服务错误', async () => {
      ;(aiService.generateMeetingMinutes as jest.Mock).mockRejectedValue(
        new Error('AI service error')
      )

      await expect(service.generateMinutes(mockMeeting))
        .rejects.toThrow('生成会议纪要失败')
    })
  })

  describe('optimizeMinutes - 优化会议纪要', () => {
    const mockMinutes = {
      id: 'minutes_1',
      title: '测试会议纪要',
      summary: '简单总结',
      keyPoints: ['要点1', '要点2'],
      actionItems: [],
      decisions: [],
      generatedAt: new Date(),
      status: 'draft'
    }

    beforeEach(() => {
      mockMeeting.minutes = mockMinutes

      ;(aiService.optimizeMeetingMinutes as jest.Mock).mockResolvedValue({
        title: '测试会议纪要(优化版)',
        summary: '详细总结包含更多细节',
        keyPoints: ['要点1', '要点2', '要点3'],
        actionItems: [
          { description: '新增行动项', assignee: '张三', priority: 'medium' }
        ],
        decisions: [],
        nextSteps: ['下一步1', '下一步2']
      })
    })

    it('应该成功优化会议纪要', async () => {
      const feedback = '请添加更多行动项和细节'

      const result = await service.optimizeMinutes(mockMeeting, feedback)

      expect(result).toBeDefined()
      expect(result.keyPoints.length).toBeGreaterThan(mockMinutes.keyPoints.length)
      expect(result.actionItems.length).toBeGreaterThan(0)

      // 验证AI服务调用
      expect(aiService.optimizeMeetingMinutes).toHaveBeenCalledWith(
        expect.stringContaining('简单总结'),
        feedback,
        expect.any(Object)
      )
    })

    it('应该在没有现有纪要时抛出错误', async () => {
      mockMeeting.minutes = null

      await expect(service.optimizeMinutes(mockMeeting, '优化'))
        .rejects.toThrow('会议没有纪要')
    })

    it('应该处理优化失败的情况', async () => {
      ;(aiService.optimizeMeetingMinutes as jest.Mock).mockRejectedValue(
        new Error('Optimization failed')
      )

      await expect(service.optimizeMinutes(mockMeeting, '优化'))
        .rejects.toThrow('优化会议纪要失败')
    })
  })

  describe('saveTranscriptionsToMeeting - 保存转录到会议', () => {
    const mockTranscriptions = [
      {
        text: '测试内容1',
        confidence: 0.95,
        speakerId: 'speaker_1',
        speakerName: '张三',
        startTime: 0,
        endTime: 3.5
      },
      {
        text: '测试内容2',
        confidence: 0.92,
        speakerId: 'speaker_2',
        speakerName: '李四',
        startTime: 3.5,
        endTime: 7.0
      }
    ]

    it('应该成功保存转录到会议对象', async () => {
      await service.saveTranscriptionsToMeeting(mockMeeting, mockTranscriptions)

      expect(mockMeeting.addTranscription).toHaveBeenCalledTimes(2)
      expect(mockMeeting.save).toHaveBeenCalled()

      // 验证第一条转录
      expect(mockMeeting.addTranscription).toHaveBeenNthCalledWith(
        1,
        'speaker_1',
        '张三',
        '测试内容1',
        0.95,
        0,
        3.5
      )

      // 验证第二条转录
      expect(mockMeeting.addTranscription).toHaveBeenNthCalledWith(
        2,
        'speaker_2',
        '李四',
        '测试内容2',
        0.92,
        3.5,
        7.0
      )
    })

    it('应该处理空数组', async () => {
      await service.saveTranscriptionsToMeeting(mockMeeting, [])

      expect(mockMeeting.addTranscription).not.toHaveBeenCalled()
      expect(mockMeeting.save).toHaveBeenCalled()
    })

    it('应该处理保存失败', async () => {
      mockMeeting.save.mockRejectedValue(new Error('Database error'))

      await expect(service.saveTranscriptionsToMeeting(mockMeeting, mockTranscriptions))
        .rejects.toThrow('保存转录失败')
    })
  })

  describe('saveMinutesToMeeting - 保存纪要到会议', () => {
    const mockMinutesResult = {
      title: '会议纪要标题',
      summary: '会议摘要',
      keyPoints: ['要点1', '要点2'],
      actionItems: [
        { description: '任务1', assignee: '张三', priority: 'high' }
      ],
      decisions: [
        { description: '决策1', decisionMaker: '李四', context: '讨论' }
      ],
      nextSteps: ['步骤1', '步骤2']
    }

    it('应该成功保存纪要到会议对象', async () => {
      await service.saveMinutesToMeeting(mockMeeting, mockMinutesResult)

      expect(mockMeeting.minutes).toBeDefined()
      expect(mockMeeting.minutes.title).toBe('会议纪要标题')
      expect(mockMeeting.minutes.summary).toBe('会议摘要')
      expect(mockMeeting.minutes.keyPoints).toEqual(['要点1', '要点2'])
      expect(mockMeeting.minutes.actionItems).toHaveLength(1)
      expect(mockMeeting.minutes.decisions).toHaveLength(1)
      expect(mockMeeting.minutes.status).toBe('draft')
      expect(mockMeeting.save).toHaveBeenCalled()
    })

    it('应该生成唯一的纪要ID', async () => {
      await service.saveMinutesToMeeting(mockMeeting, mockMinutesResult)

      expect(mockMeeting.minutes.id).toBeDefined()
      expect(mockMeeting.minutes.id).toContain('minutes_')
    })

    it('应该设置生成时间', async () => {
      await service.saveMinutesToMeeting(mockMeeting, mockMinutesResult)

      expect(mockMeeting.minutes.generatedAt).toBeInstanceOf(Date)
    })

    it('应该处理保存失败', async () => {
      mockMeeting.save.mockRejectedValue(new Error('Database error'))

      await expect(service.saveMinutesToMeeting(mockMeeting, mockMinutesResult))
        .rejects.toThrow('保存纪要失败')
    })
  })

  describe('完整流程测试 - processAudioAndGenerateMinutes', () => {
    const mockAudioPath = '/uploads/meeting-audio.wav'

    beforeEach(() => {
      // Mock所有依赖
      ;(audioService.getAudioMetadata as jest.Mock).mockResolvedValue({
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        format: 'mp3'
      })
      ;(audioService.convertAudio as jest.Mock).mockResolvedValue(undefined)
      ;(audioService.createTempFilePath as jest.Mock).mockReturnValue('/tmp/converted.wav')

      ;(speechService.recognizeFromFile as jest.Mock).mockResolvedValue([
        {
          text: '会议内容',
          confidence: 0.95,
          speakerId: 'speaker_1',
          speakerName: '',
          startTime: 0,
          endTime: 5
        }
      ])

      ;(voiceprintService.identifySpeakers as jest.Mock).mockResolvedValue([
        { speakerId: 'speaker_1', name: '张三', email: 'zhangsan@example.com', confidence: 0.95 }
      ])

      ;(aiService.generateMeetingMinutes as jest.Mock).mockResolvedValue({
        title: '会议纪要',
        summary: '总结',
        keyPoints: ['要点'],
        actionItems: [],
        decisions: [],
        nextSteps: []
      })
    })

    it('应该完成从音频到纪要的完整流程', async () => {
      // 修复: addTranscription 需要更新 mockMeeting.transcriptions
      mockMeeting.addTranscription = jest.fn((speakerId, speakerName, content, confidence, startTime, endTime) => {
        mockMeeting.transcriptions.push({
          id: Math.random().toString(),
          speakerId,
          speakerName,
          content,
          confidence,
          startTime,
          endTime,
          timestamp: new Date()
        })
      })

      const result = await service.processAudioAndGenerateMinutes(
        mockAudioPath,
        mockMeeting,
        { autoGenerateMinutes: true }
      )

      expect(result).toBeDefined()
      expect(result.transcriptions).toBeInstanceOf(Array)
      expect(result.minutes).toBeDefined()
      expect(result.minutes.title).toBe('会议纪要')

      // 验证所有步骤都被执行
      expect(audioService.getAudioMetadata).toHaveBeenCalled()
      expect(speechService.recognizeFromFile).toHaveBeenCalled()
      expect(aiService.generateMeetingMinutes).toHaveBeenCalled()
      expect(mockMeeting.save).toHaveBeenCalledTimes(2) // 保存转录和纪要
    })

    it('应该支持仅处理音频不生成纪要', async () => {
      const result = await service.processAudioAndGenerateMinutes(
        mockAudioPath,
        mockMeeting,
        { autoGenerateMinutes: false }
      )

      expect(result.transcriptions).toBeDefined()
      expect(result.minutes).toBeUndefined()
      expect(aiService.generateMeetingMinutes).not.toHaveBeenCalled()
    })
  })
})
