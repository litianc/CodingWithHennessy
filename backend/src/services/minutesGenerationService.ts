// @ts-nocheck
/**
 * 会议纪要生成服务
 * 整合音频处理、语音识别、声纹识别和AI纪要生成的完整流程
 */

import { logger } from '@/utils/logger'
import { audioService, AudioMetadata } from './audioService'
import { speechService, TranscriptionResult } from './speechRecognitionService'
import { voiceprintService } from './voiceprintService'
import { aiService, MeetingMinutesResult, MeetingMinutesOptions } from './aiService'
import { fileTransService } from './fileTransService'
import { IMeeting } from '@/models/Meeting'

export interface ProcessAudioOptions {
  autoGenerateMinutes?: boolean
  enableVoiceprint?: boolean
  language?: string
}

export interface ProcessAudioResult {
  audioMetadata: AudioMetadata
  transcriptions: TranscriptionResult[]
  speakers?: Array<{
    speakerId: string
    name: string
    email?: string
    confidence: number
  }>
  minutes?: MeetingMinutesResult
  convertedAudioPath?: string
}

export class MinutesGenerationService {
  /**
   * 处理音频文件:格式转换、语音识别、声纹识别
   */
  async processAudioFile(
    audioFilePath: string,
    meeting: IMeeting
  ): Promise<ProcessAudioResult> {
    try {
      logger.info(`开始处理音频文件: ${audioFilePath}`)

      // 1. 获取音频元数据
      const audioMetadata = await audioService.getAudioMetadata(audioFilePath)
      logger.info(`音频元数据: 时长=${audioMetadata.duration}s, 采样率=${audioMetadata.sampleRate}Hz`)

      // 2. 检查音频格式,如果需要则转换为16kHz单声道WAV
      let processedAudioPath = audioFilePath
      if (audioMetadata.sampleRate !== 16000 || audioMetadata.channels !== 1) {
        logger.info('音频格式需要转换')
        const convertedPath = audioService.createTempFilePath('wav')

        await audioService.convertAudio(audioFilePath, convertedPath, {
          sampleRate: 16000,
          channels: 1,
          format: 'wav',
          bitrate: 128
        })

        processedAudioPath = convertedPath
        logger.info(`音频格式转换完成: ${convertedPath}`)
      }

      // 3. 语音识别（使用FileTrans服务，支持大文件和长时音频）
      logger.info('开始语音识别（使用FileTrans服务）...')
      const language = meeting.settings?.language || 'zh-CN'
      const enableSpeakerDiarization = meeting.settings?.enableVoiceprint !== false

      const transcriptions = await fileTransService.recognizeFile(processedAudioPath, {
        enableWords: true,
        enablePunctuation: true,
        enableInverseTextNormalization: true,
        maxWaitTime: 600000, // 10分钟超时
        deleteAfterRecognition: false // 保留OSS文件供后续处理
      })

      logger.info(`语音识别完成,共 ${transcriptions.length} 条转录记录`)

      const result: ProcessAudioResult = {
        audioMetadata,
        transcriptions,
        convertedAudioPath: processedAudioPath !== audioFilePath ? processedAudioPath : undefined
      }

      // 4. 声纹识别(如果启用)
      if (meeting.settings?.enableVoiceprint && transcriptions.length > 0) {
        try {
          logger.info('开始声纹识别...')
          const speakers = await voiceprintService.identifySpeakers(processedAudioPath, transcriptions)

          // 将识别的发言人信息关联到转录记录
          if (speakers && speakers.length > 0) {
            const speakerMap = new Map(speakers.map(s => [s.speakerId, s]))

            transcriptions.forEach(trans => {
              const speaker = speakerMap.get(trans.speakerId)
              if (speaker) {
                trans.speakerName = speaker.name
              }
            })

            result.speakers = speakers
            logger.info(`声纹识别完成,识别到 ${speakers.length} 位发言人`)
          }
        } catch (error) {
          logger.warn('声纹识别失败,继续使用speaker ID', error)
        }
      }

      return result
    } catch (error) {
      logger.error('处理音频文件失败:', error)
      throw new Error('语音识别失败')
    }
  }

  /**
   * 生成会议纪要
   */
  async generateMinutes(
    meeting: IMeeting,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
    // 检查是否有转录内容
    if (!meeting.transcriptions || meeting.transcriptions.length === 0) {
      throw new Error('会议没有转录内容,无法生成纪要')
    }

    try {
      logger.info(`开始生成会议纪要: ${meeting.title}`)

      // 构建转录文本
      const transcriptionText = meeting.transcriptions
        .map(t => `[${t.speakerName || t.speakerId}]: ${t.content}`)
        .join('\n')

      logger.debug(`转录文本长度: ${transcriptionText.length} 字符`)

      // 调用AI服务生成纪要
      const minutesOptions: MeetingMinutesOptions = {
        title: meeting.title,
        language: meeting.settings?.language || 'zh-CN',
        includeActionItems: true,
        includeDecisions: true,
        includeKeyPoints: true,
        ...options
      }

      const minutesResult = await aiService.generateMeetingMinutes(transcriptionText, minutesOptions)

      logger.info('会议纪要生成成功')
      return minutesResult
    } catch (error) {
      logger.error('生成会议纪要失败:', error)
      throw new Error('生成会议纪要失败')
    }
  }

  /**
   * 优化会议纪要
   */
  async optimizeMinutes(
    meeting: IMeeting,
    feedback: string,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
    if (!meeting.minutes) {
      throw new Error('会议没有纪要,请先生成纪要')
    }

    try {
      logger.info(`开始优化会议纪要: ${meeting.title}`)

      // 构建当前纪要文本
      const currentMinutesText = `
标题: ${meeting.minutes.title}
摘要: ${meeting.minutes.summary}
关键要点: ${meeting.minutes.keyPoints?.join('\n') || '无'}
行动项: ${meeting.minutes.actionItems?.map(item =>
  `- ${item.description} (负责人: ${item.assignee || '未指定'}, 优先级: ${item.priority})`
).join('\n') || '无'}
决策: ${meeting.minutes.decisions?.map(dec =>
  `- ${dec.description} (决策者: ${dec.decisionMaker || '未指定'})`
).join('\n') || '无'}
      `.trim()

      // 调用AI服务优化纪要
      const optimizedResult = await aiService.optimizeMeetingMinutes(
        currentMinutesText,
        feedback,
        {
          title: meeting.title,
          language: meeting.settings?.language || 'zh-CN',
          ...options
        }
      )

      logger.info('会议纪要优化成功')
      return optimizedResult
    } catch (error) {
      logger.error('优化会议纪要失败:', error)
      throw new Error('优化会议纪要失败')
    }
  }

  /**
   * 保存转录到会议对象
   */
  async saveTranscriptionsToMeeting(
    meeting: IMeeting,
    transcriptions: TranscriptionResult[]
  ): Promise<void> {
    try {
      logger.info(`保存 ${transcriptions.length} 条转录到会议 ${meeting._id}`)

      // 添加转录记录
      transcriptions.forEach(trans => {
        meeting.addTranscription(
          trans.speakerId,
          trans.speakerName || trans.speakerId,
          trans.text,
          trans.confidence,
          trans.startTime,
          trans.endTime
        )
      })

      // 保存到数据库
      await meeting.save()

      logger.info('转录保存成功')
    } catch (error) {
      logger.error('保存转录失败:', error)
      throw new Error('保存转录失败')
    }
  }

  /**
   * 保存纪要到会议对象
   */
  async saveMinutesToMeeting(
    meeting: IMeeting,
    minutesResult: MeetingMinutesResult
  ): Promise<void> {
    try {
      logger.info(`保存会议纪要到会议 ${meeting._id}`)

      // 构建纪要对象
      meeting.minutes = {
        id: `minutes_${Date.now()}`,
        title: minutesResult.title,
        summary: minutesResult.summary,
        keyPoints: minutesResult.keyPoints,
        actionItems: minutesResult.actionItems.map(item => ({
          description: item.description,
          assignee: item.assignee || '未指定',
          priority: item.priority,
          dueDate: undefined
        })) as any,
        decisions: minutesResult.decisions.map(dec => ({
          description: dec.description,
          decisionMaker: dec.decisionMaker || '未指定',
          timestamp: new Date()
        })) as any,
        generatedAt: new Date(),
        status: 'draft'
      }

      // 保存到数据库
      await meeting.save()

      logger.info('会议纪要保存成功')
    } catch (error) {
      logger.error('保存纪要失败:', error)
      throw new Error('保存纪要失败')
    }
  }

  /**
   * 完整流程:处理音频并生成纪要
   */
  async processAudioAndGenerateMinutes(
    audioFilePath: string,
    meeting: IMeeting,
    options: ProcessAudioOptions = {}
  ): Promise<ProcessAudioResult> {
    try {
      logger.info(`开始完整流程:音频处理 → 语音识别 → 纪要生成`)

      // 1. 处理音频文件
      const processResult = await this.processAudioFile(audioFilePath, meeting)

      // 2. 保存转录到会议
      await this.saveTranscriptionsToMeeting(meeting, processResult.transcriptions)

      // 3. 生成会议纪要(如果启用)
      if (options.autoGenerateMinutes !== false) {
        const minutesResult = await this.generateMinutes(meeting, {
          language: options.language || meeting.settings?.language
        })

        // 保存纪要到会议
        await this.saveMinutesToMeeting(meeting, minutesResult)

        processResult.minutes = minutesResult
      }

      logger.info('完整流程执行成功')
      return processResult
    } catch (error) {
      logger.error('处理音频并生成纪要失败:', error)
      throw error
    }
  }
}

// 导出单例实例
export const minutesGenerationService = new MinutesGenerationService()
