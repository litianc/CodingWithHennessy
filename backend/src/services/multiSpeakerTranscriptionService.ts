/**
 * 多说话人转录服务
 *
 * 协调FunASR和3D-Speaker服务，实现多说话人语音识别
 */
import { funasrWebSocketService, FunASRResult } from './funasrWebSocketService'
import { speakerRecognitionService } from './speakerRecognitionService'
import { voiceprintManagementService } from './voiceprintManagementService'
import { logger } from '@/utils/logger'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'

export interface MultiSpeakerSegment {
  id: string
  speakerId: string
  speakerName: string
  isUnknown: boolean
  content: string
  startTime: number
  endTime: number
  confidence: number
  voiceprintConfidence?: number
  words?: Array<{
    word: string
    startTime: number
    endTime: number
    confidence?: number
  }>
}

export interface SpeakerStats {
  speakerId: string
  name: string
  department?: string
  isKnown: boolean
  isUnknown: boolean
  voiceprintId?: string
  segmentCount: number
  totalDuration: number
  percentage: number
  avgConfidence: number
}

export interface MultiSpeakerTranscriptionResult {
  segments: MultiSpeakerSegment[]
  speakers: SpeakerStats[]
  speakerCount: number
  unknownSpeakerCount: number
  totalDuration: number
}

export interface TranscriptionOptions {
  language?: string
  enablePunctuation?: boolean
  enableWordTimestamp?: boolean
  userId?: string // 用于访问声纹库
}

export class MultiSpeakerTranscriptionService {
  /**
   * 处理音频文件，生成多说话人转录
   *
   * 流程：
   * 1. 使用3D-Speaker进行说话人分割(diarization)
   * 2. 对每个说话人片段进行声纹识别
   * 3. 使用FunASR对整个音频进行语音识别
   * 4. 合并结果，生成带说话人标注的转录
   */
  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<MultiSpeakerTranscriptionResult> {
    try {
      logger.info(`开始多说话人转录: ${audioPath}`, options)

      // Check if voiceprint feature is enabled
      const enableVoiceprint = process.env.ENABLE_VOICEPRINT !== 'false'

      if (!enableVoiceprint) {
        logger.info('声纹识别功能已禁用，使用单说话人模式')
        return await this.transcribeWithoutDiarization(audioPath, options)
      }

      // Step 1: 说话人分割
      logger.info('Step 1: 执行说话人分割...')
      let diarizationSegments

      try {
        diarizationSegments = await speakerRecognitionService.diarization(audioPath)
      } catch (error: any) {
        logger.warn(`说话人分割失败: ${error.message}，使用单说话人模式`)
        return await this.transcribeWithoutDiarization(audioPath, options)
      }

      if (!diarizationSegments || diarizationSegments.length === 0) {
        logger.warn('说话人分割未返回结果，使用单说话人模式')
        return await this.transcribeWithoutDiarization(audioPath, options)
      }

      logger.info(`说话人分割完成，检测到 ${diarizationSegments.length} 个片段`)

      // Step 2: 对每个说话人片段进行声纹识别
      logger.info('Step 2: 识别说话人身份...')
      const speakerIdentities = await this.identifySpeakers(diarizationSegments, audioPath, options.userId)

      // Step 3: 语音识别（使用FunASR WebSocket识别整个音频）
      logger.info('Step 3: 执行语音识别...')
      const asrResult = await funasrWebSocketService.transcribeFile(audioPath)

      // Step 4: 合并结果
      logger.info('Step 4: 合并识别结果...')
      const segments = this.mergeResults(diarizationSegments, speakerIdentities, asrResult)

      // Step 5: 计算统计信息
      logger.info('Step 5: 计算说话人统计...')
      const { speakers, speakerCount, unknownSpeakerCount, totalDuration } =
        this.calculateStatistics(segments)

      logger.info('多说话人转录完成', {
        segments: segments.length,
        speakers: speakerCount,
        unknownSpeakers: unknownSpeakerCount,
        duration: totalDuration
      })

      return {
        segments,
        speakers,
        speakerCount,
        unknownSpeakerCount,
        totalDuration
      }

    } catch (error: any) {
      logger.error('多说话人转录失败:', error)
      throw new Error(`多说话人转录失败: ${error.message}`)
    }
  }

  /**
   * 提取音频片段
   * 使用ffmpeg从原始音频中提取指定时间范围的片段
   */
  private async extractAudioSegment(
    audioPath: string,
    startTime: number,
    endTime: number
  ): Promise<string> {
    const duration = endTime - startTime
    const outputPath = path.join(
      path.dirname(audioPath),
      `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`
    )

    logger.debug(`提取音频片段: ${startTime}s - ${endTime}s (${duration}s) → ${outputPath}`)

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(outputPath)
        .on('end', () => {
          logger.debug(`音频片段提取完成: ${outputPath}`)
          resolve(outputPath)
        })
        .on('error', (err) => {
          logger.error(`音频片段提取失败: ${err.message}`)
          reject(new Error(`音频片段提取失败: ${err.message}`))
        })
        .run()
    })
  }

  /**
   * 识别说话人身份
   * 策略：从每个说话人的片段中选择第一个足够长的片段（5-30秒）进行声纹识别
   */
  private async identifySpeakers(
    diarizationSegments: any[],
    audioPath: string,
    userId?: string
  ): Promise<Map<string, any>> {
    const speakerIdentities = new Map()

    // 获取唯一的说话人ID
    const uniqueSpeakerIds = Array.from(new Set(diarizationSegments.map(s => s.speaker_id)))

    logger.info(`识别 ${uniqueSpeakerIds.length} 个说话人的身份`)

    // 对每个说话人进行识别
    for (const speakerId of uniqueSpeakerIds) {
      let segmentPath: string | null = null

      try {
        // 获取该说话人的所有片段
        const speakerSegments = diarizationSegments.filter(s => s.speaker_id === speakerId)

        // 策略1：选择第一个足够长的片段（至少5秒）
        // 如果所有片段都太短，则选择第一个片段
        const MIN_DURATION = 5  // 最小5秒
        const MAX_DURATION = 30 // 最大30秒（3D-Speaker限制）

        let representativeSegment = speakerSegments.find(s =>
          (s.end_time - s.start_time) >= MIN_DURATION
        )

        if (!representativeSegment) {
          // 如果没有足够长的片段，使用第一个片段
          representativeSegment = speakerSegments[0]
          logger.warn(`说话人 ${speakerId} 没有足够长的片段，使用首个片段 (${representativeSegment.end_time - representativeSegment.start_time}s)`)
        }

        // 计算提取的时间范围（限制在30秒内）
        const startTime = representativeSegment.start_time
        const segmentDuration = representativeSegment.end_time - representativeSegment.start_time
        const extractDuration = Math.min(segmentDuration, MAX_DURATION)
        const endTime = startTime + extractDuration

        logger.info(`说话人 ${speakerId}: 从 ${startTime.toFixed(2)}s 提取 ${extractDuration.toFixed(2)}s 音频片段`)

        // 提取音频片段
        segmentPath = await this.extractAudioSegment(audioPath, startTime, endTime)

        // 使用提取的片段进行声纹识别
        const matches = await voiceprintManagementService.recognize(segmentPath, 1)

        if (matches && matches.length > 0 && matches[0].isMatch) {
          const bestMatch = matches[0]
          speakerIdentities.set(speakerId, {
            voiceprintId: bestMatch.voiceprintId,
            name: bestMatch.name,
            department: bestMatch.department,
            confidence: bestMatch.confidence,
            isKnown: true,
            isUnknown: false
          })
          logger.info(`说话人 ${speakerId} 识别为: ${bestMatch.name} (confidence: ${bestMatch.confidence})`)
        } else {
          // 未识别的说话人
          speakerIdentities.set(speakerId, {
            voiceprintId: null,
            name: `未知说话人${uniqueSpeakerIds.indexOf(speakerId) + 1}`,
            department: null,
            confidence: 0,
            isKnown: false,
            isUnknown: true
          })
          logger.info(`说话人 ${speakerId} 未能识别`)
        }
      } catch (error) {
        logger.error(`识别说话人 ${speakerId} 失败:`, error)
        speakerIdentities.set(speakerId, {
          voiceprintId: null,
          name: `未知说话人${uniqueSpeakerIds.indexOf(speakerId) + 1}`,
          department: null,
          confidence: 0,
          isKnown: false,
          isUnknown: true
        })
      } finally {
        // 清理临时音频片段文件
        if (segmentPath) {
          try {
            await fs.unlink(segmentPath)
            logger.debug(`已清理临时文件: ${segmentPath}`)
          } catch (cleanupError) {
            logger.warn(`清理临时文件失败: ${segmentPath}`, cleanupError)
          }
        }
      }
    }

    return speakerIdentities
  }

  /**
   * 合并说话人分割和语音识别结果
   */
  private mergeResults(
    diarizationSegments: any[],
    speakerIdentities: Map<string, any>,
    asrResult: FunASRResult
  ): MultiSpeakerSegment[] {
    const segments: MultiSpeakerSegment[] = []

    // 使用 FunASR 返回的句子级时间戳 (stamp_sents)
    if (asrResult && asrResult.stamp_sents && asrResult.stamp_sents.length > 0) {
      logger.info(`FunASR 返回 ${asrResult.stamp_sents.length} 个句子片段`)

      for (const sent of asrResult.stamp_sents) {
        // 根据时间戳找到对应的说话人
        const speakerId = this.findSpeakerByTime(
          diarizationSegments,
          sent.start,
          sent.end
        )

        const speakerInfo = speakerIdentities.get(speakerId) || {
          name: '未知说话人',
          isKnown: false,
          isUnknown: true,
          confidence: 0
        }

        // 提取词级时间戳
        const words = sent.ts_list.map((ts: number[], idx: number) => ({
          word: sent.text_seg.split(' ')[idx] || '',
          startTime: ts[0],
          endTime: ts[1],
          confidence: 0.9
        }))

        segments.push({
          id: `seg-${segments.length + 1}`,
          speakerId: speakerId,
          speakerName: speakerInfo.name,
          isUnknown: speakerInfo.isUnknown,
          content: sent.text_seg + sent.punc, // 文本 + 标点
          startTime: sent.start,
          endTime: sent.end,
          confidence: 0.9, // FunASR 没有返回句子级置信度
          voiceprintConfidence: speakerInfo.confidence,
          words
        })
      }

      logger.info(`合并完成，生成 ${segments.length} 个片段`)
    }

    return segments
  }

  /**
   * 根据时间戳找到对应的说话人
   */
  private findSpeakerByTime(
    diarizationSegments: any[],
    startTime: number,
    endTime: number
  ): string {
    // 找到时间重叠最多的说话人片段
    const midTime = (startTime + endTime) / 2

    for (const segment of diarizationSegments) {
      const segStart = segment.start_time * 1000 // 转为毫秒
      const segEnd = segment.end_time * 1000

      if (midTime >= segStart && midTime <= segEnd) {
        return segment.speaker_id
      }
    }

    // 如果没有找到，返回第一个说话人或默认ID
    return diarizationSegments[0]?.speaker_id || 'speaker-unknown'
  }

  /**
   * 分句处理
   */
  private splitIntoSentences(text: string): string[] {
    // 按照标点符号分句
    const sentences = text.split(/[。！？；\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    return sentences
  }

  /**
   * 计算说话人统计信息
   */
  private calculateStatistics(segments: MultiSpeakerSegment[]): {
    speakers: SpeakerStats[]
    speakerCount: number
    unknownSpeakerCount: number
    totalDuration: number
  } {
    const speakerMap = new Map<string, SpeakerStats>()
    let totalDuration = 0

    // 统计每个说话人的信息
    for (const segment of segments) {
      const duration = segment.endTime - segment.startTime
      totalDuration += duration

      if (!speakerMap.has(segment.speakerId)) {
        speakerMap.set(segment.speakerId, {
          speakerId: segment.speakerId,
          name: segment.speakerName,
          department: undefined, // TODO: 从voiceprint获取
          isKnown: !segment.isUnknown,
          isUnknown: segment.isUnknown,
          voiceprintId: undefined, // TODO: 从识别结果获取
          segmentCount: 0,
          totalDuration: 0,
          percentage: 0,
          avgConfidence: 0
        })
      }

      const stats = speakerMap.get(segment.speakerId)!
      stats.segmentCount++
      stats.totalDuration += duration
      stats.avgConfidence = (stats.avgConfidence * (stats.segmentCount - 1) + segment.confidence) / stats.segmentCount
    }

    // 计算百分比
    for (const stats of speakerMap.values()) {
      stats.percentage = totalDuration > 0 ? (stats.totalDuration / totalDuration) * 100 : 0
    }

    const speakers = Array.from(speakerMap.values())
    const speakerCount = speakers.length
    const unknownSpeakerCount = speakers.filter(s => s.isUnknown).length

    return {
      speakers,
      speakerCount,
      unknownSpeakerCount,
      totalDuration
    }
  }

  /**
   * 无说话人分割的转录（fallback）
   */
  private async transcribeWithoutDiarization(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<MultiSpeakerTranscriptionResult> {
    logger.info('使用单说话人模式进行转录')

    const asrResult = await funasrWebSocketService.transcribeFile(audioPath)

    const segments: MultiSpeakerSegment[] = []
    let totalDuration = 0

    // 将所有句子分配给同一个说话人
    if (asrResult && asrResult.stamp_sents) {
      for (const sent of asrResult.stamp_sents) {
        const words = sent.ts_list.map((ts: number[], idx: number) => ({
          word: sent.text_seg.split(' ')[idx] || '',
          startTime: ts[0],
          endTime: ts[1],
          confidence: 0.9
        }))

        segments.push({
          id: `seg-${segments.length + 1}`,
          speakerId: 'speaker-1',
          speakerName: '说话人1',
          isUnknown: true,
          content: sent.text_seg + sent.punc,
          startTime: sent.start,
          endTime: sent.end,
          confidence: 0.9,
          words
        })

        totalDuration = Math.max(totalDuration, sent.end)
      }
    }

    const speakers: SpeakerStats[] = [{
      speakerId: 'speaker-1',
      name: '说话人1',
      isKnown: false,
      isUnknown: true,
      segmentCount: segments.length,
      totalDuration: totalDuration,
      percentage: 100,
      avgConfidence: 0.9
    }]

    return {
      segments,
      speakers,
      speakerCount: 1,
      unknownSpeakerCount: 1,
      totalDuration
    }
  }
}

// 导出单例实例
export const multiSpeakerTranscriptionService = new MultiSpeakerTranscriptionService()
