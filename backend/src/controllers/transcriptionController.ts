import { Response } from 'express'
import { validationResult } from 'express-validator'
import { Meeting } from '@/models/Meeting'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { speechService } from '@/services/speechRecognitionService'
import { audioService } from '@/services/audioService'
import { multiSpeakerTranscriptionService } from '@/services/multiSpeakerTranscriptionService'
import { logger } from '@/utils/logger'
import { emitToMeeting } from '@/utils/socket'

// 从音频文件生成转录
export const transcribeFromFile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId, options = {} } = req.body
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权限操作此会议'
    })
    return
  }

  // 检查是否有录音文件
  if (!meeting.recording) {
    res.status(400).json({
      success: false,
      message: '会议没有录音文件'
    })
    return
  }

  try {
    // 获取录音文件路径
    const audioFilePath = audioService.getFilePath(meeting.recording.filename)

    // 检查是否启用声纹识别（多说话人模式）
    const useMultiSpeaker = meeting.settings.enableVoiceprint

    if (useMultiSpeaker) {
      logger.info('使用多说话人转录模式')

      // 调用多说话人转录服务
      const result = await multiSpeakerTranscriptionService.transcribe(audioFilePath, {
        language: meeting.settings.language || 'zh-cn',
        enablePunctuation: true,
        enableWordTimestamp: true,
        userId: userId.toString()
      })

      // 清空原有的转录记录和说话人统计
      meeting.transcriptions = []
      meeting.speakers = []
      logger.info(`清空会议 ${meetingId} 的原有转录记录和说话人统计`)

      // 保存说话人统计信息
      meeting.speakers = result.speakers
      meeting.speakerCount = result.speakerCount
      meeting.unknownSpeakerCount = result.unknownSpeakerCount

      // 保存转录片段（包含说话人信息、词级时间戳等）
      result.segments.forEach(segment => {
        meeting.transcriptions.push({
          id: segment.id,
          speakerId: segment.speakerId,
          speakerName: segment.speakerName,
          content: segment.content,
          timestamp: new Date(),
          confidence: segment.confidence,
          startTime: segment.startTime,
          endTime: segment.endTime,
          words: segment.words,
          isUnknown: segment.isUnknown
        })
      })

      await meeting.save()

      // 通知会议中的其他用户（包含说话人统计）
      emitToMeeting(meetingId, 'transcription-completed', {
        meetingId,
        transcriptionCount: result.segments.length,
        speakerCount: result.speakerCount,
        unknownSpeakerCount: result.unknownSpeakerCount,
        speakers: result.speakers,
        timestamp: new Date()
      })

      logger.info(`多说话人音频转录完成: ${meetingId}`, {
        segments: result.segments.length,
        speakers: result.speakerCount,
        unknownSpeakers: result.unknownSpeakerCount
      })

      res.json({
        success: true,
        message: '多说话人转录完成',
        data: {
          transcriptions: result.segments,
          speakers: result.speakers,
          speakerCount: result.speakerCount,
          unknownSpeakerCount: result.unknownSpeakerCount,
          total: result.segments.length
        }
      })

    } else {
      // 使用传统单说话人模式
      logger.info('使用传统单说话人转录模式')

      // 识别选项
      const recognitionOptions = {
        language: meeting.settings.language,
        enablePunctuation: true,
        enableInverseTextNormalization: true,
        enableSpeakerDiarization: false,
        ...options
      }

      // 执行语音识别
      const results = await speechService.recognizeFromFile(audioFilePath, recognitionOptions)

      // 清空原有的转录记录（覆盖模式）
      meeting.transcriptions = []
      logger.info(`清空会议 ${meetingId} 的原有转录记录，准备添加新的转录结果`)

      // 将转录结果保存到会议中
      results.forEach(result => {
        meeting.addTranscription(
          result.speakerId || 'unknown',
          result.speakerName || '未知说话人',
          result.text,
          result.confidence,
          result.startTime,
          result.endTime
        )
      })

      await meeting.save()

      // 通知会议中的其他用户
      emitToMeeting(meetingId, 'transcription-completed', {
        meetingId,
        transcriptionCount: results.length,
        timestamp: new Date()
      })

      logger.info(`音频转录完成: ${meetingId}, 转录了 ${results.length} 条记录`)

      res.json({
        success: true,
        message: '转录完成',
        data: {
          transcriptions: results,
          total: results.length
        }
      })
    }
  } catch (error) {
    logger.error('音频转录失败:', error)
    res.status(500).json({
      success: false,
      message: '转录失败，请稍后重试'
    })
  }
})

// 获取会议转录记录
export const getTranscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.params
  const userId = req.user!._id
  const { page = 1, limit = 50 } = req.query

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权限访问此会议'
    })
    return
  }

  // 分页获取转录记录
  const skip = (Number(page) - 1) * Number(limit)
  const transcriptions = meeting.transcriptions
    .sort((a, b) => a.startTime - b.startTime)
    .slice(skip, skip + Number(limit))

  const total = meeting.transcriptions.length

  res.json({
    success: true,
    data: {
      transcriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
})

// 更新转录记录
export const updateTranscription = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId, transcriptionId } = req.params
  const { content, speakerName } = req.body
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以编辑转录记录'
    })
    return
  }

  // 查找转录记录
  const transcription = meeting.transcriptions.find(t => t.id === transcriptionId)
  if (!transcription) {
    res.status(404).json({
      success: false,
      message: '转录记录不存在'
    })
    return
  }

  // 更新转录内容
  if (content !== undefined) transcription.content = content
  if (speakerName !== undefined) transcription.speakerName = speakerName

  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'transcription-updated', {
    transcriptionId,
    content: transcription.content,
    speakerName: transcription.speakerName,
    timestamp: new Date()
  })

  logger.info(`转录记录更新: ${transcriptionId} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '转录记录更新成功',
    data: { transcription }
  })
})

// 删除转录记录
export const deleteTranscription = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId, transcriptionId } = req.params
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以删除转录记录'
    })
    return
  }

  // 删除转录记录
  const transcriptionIndex = meeting.transcriptions.findIndex(t => t.id === transcriptionId)
  if (transcriptionIndex === -1) {
    res.status(404).json({
      success: false,
      message: '转录记录不存在'
    })
    return
  }

  meeting.transcriptions.splice(transcriptionIndex, 1)
  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'transcription-deleted', {
    transcriptionId,
    timestamp: new Date()
  })

  logger.info(`转录记录删除: ${transcriptionId} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '转录记录删除成功'
  })
})

// 批量更新说话人信息
export const updateSpeakerInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId } = req.params
  const { speakerId, speakerName } = req.body
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以更新说话人信息'
    })
    return
  }

  // 批量更新说话人信息
  let updatedCount = 0
  meeting.transcriptions.forEach(transcription => {
    if (transcription.speakerId === speakerId) {
      transcription.speakerName = speakerName
      updatedCount++
    }
  })

  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'speaker-info-updated', {
    speakerId,
    speakerName,
    updatedCount,
    timestamp: new Date()
  })

  logger.info(`说话人信息更新: ${speakerId} -> ${speakerName}, 更新了 ${updatedCount} 条记录`)

  res.json({
    success: true,
    message: '说话人信息更新成功',
    data: {
      speakerId,
      speakerName,
      updatedCount
    }
  })
})