// @ts-nocheck
/**
 * 会议纪要Controller
 * 处理音频上传和纪要生成相关的HTTP请求
 */

import { Response } from 'express'
import { validationResult } from 'express-validator'
import path from 'path'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { Meeting } from '@/models/Meeting'
import { minutesGenerationService } from '@/services/minutesGenerationService'
import { audioService } from '@/services/audioService'
import { logger } from '@/utils/logger'
import { getSocketIO } from '@/utils/socket'
import { MinutesWebSocketHandler } from '@/websocket/minutesHandler'

/**
 * 上传音频文件并生成会议纪要
 * POST /api/meetings/:meetingId/upload-audio
 */
export const uploadAudioAndGenerateMinutes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const userId = req.user!._id
    const autoGenerateMinutes = req.body.autoGenerateMinutes !== 'false'
    const transcriptionMode = req.body.transcriptionMode === 'append' ? 'append' : 'overwrite' // 默认覆盖模式

    // 检查是否上传了文件
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: '请上传音频文件'
      })
      return
    }

    try {
      // 验证文件类型
      const allowedMimeTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/webm',
        'audio/ogg',
        'audio/mp4',
        'audio/x-m4a'
      ]

      const allowedExtensions = ['.mp3', '.wav', '.webm', '.ogg', '.m4a', '.mp4']
      const fileExtension = path.extname(req.file.originalname).toLowerCase()

      if (
        !allowedMimeTypes.includes(req.file.mimetype) &&
        !allowedExtensions.includes(fileExtension)
      ) {
        res.status(400).json({
          success: false,
          message: '不支持的文件类型,请上传 MP3, WAV, WebM, OGG 或 M4A 格式的音频文件'
        })
        return
      }

      // 验证文件大小(限制512MB - 支持大文件录音识别)
      const maxSize = 512 * 1024 * 1024
      if (req.file.size > maxSize) {
        res.status(400).json({
          success: false,
          message: '文件大小超过限制,最大支持 512MB'
        })
        return
      }

      // 查找会议
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

      logger.info(`用户 ${userId} 上传音频到会议 ${meetingId}`)

      // 保存音频文件
      const audioFilename = await audioService.saveAudioFile(
        req.file.buffer,
        req.file.originalname
      )
      const audioFilePath = audioService.getFilePath(audioFilename)

      logger.info(`音频文件保存成功: ${audioFilePath}`)

      // 获取WebSocket实例
      const io = getSocketIO()
      let wsHandler: MinutesWebSocketHandler | null = null

      if (io && autoGenerateMinutes) {
        wsHandler = new MinutesWebSocketHandler(io)
        wsHandler.emitGenerationStarted(meetingId)
      }

      // 先启动模拟三阶段进度，不等待完成
      const simulationPromise = wsHandler
        ? wsHandler.simulateGenerationStages(meetingId).catch(err => {
            logger.error('模拟生成阶段失败:', err)
          })
        : Promise.resolve()

      // 处理音频并生成纪要
      const result = await minutesGenerationService.processAudioAndGenerateMinutes(
        audioFilePath,
        meeting,
        {
          autoGenerateMinutes,
          transcriptionMode
        }
      )

      // 发送转录完成事件（通知前端清空并重新加载转录）
      if (io) {
        io.to(`meeting-${meetingId}`).emit('transcription-completed', {
          meetingId,
          transcriptionCount: result.transcriptions.length,
          timestamp: new Date().toISOString()
        })
        logger.info(`发送转录完成事件: ${meetingId}, 共 ${result.transcriptions.length} 条转录`)
      }

      // 等待模拟阶段完成后再发送完成事件
      await simulationPromise

      // 发送完成事件
      if (wsHandler && result.minutes) {
        wsHandler.emitGenerationCompleted({
          meetingId,
          minutesId: meeting.minutes?.id || '',
          minutes: meeting.minutes,
          timestamp: new Date().toISOString()
        })
      }

      logger.info('音频处理和纪要生成完成')

      // 构建响应
      const response: any = {
        success: true,
        message: autoGenerateMinutes ? '音频处理和纪要生成成功' : '音频处理成功',
        data: {
          audioFile: {
            filename: audioFilename,
            duration: result.audioMetadata.duration,
            size: result.audioMetadata.size,
            format: result.audioMetadata.format
          },
          transcriptions: result.transcriptions.map(t => ({
            speakerId: t.speakerId,
            speakerName: t.speakerName,
            content: t.text,
            confidence: t.confidence,
            startTime: t.startTime,
            endTime: t.endTime
          })),
          speakers: result.speakers
        }
      }

      if (result.minutes) {
        response.data.minutes = result.minutes
      }

      res.json(response)
    } catch (error: any) {
      logger.error('上传音频和生成纪要失败:', error)

      // 发送错误事件
      const io = getSocketIO()
      if (io) {
        const wsHandler = new MinutesWebSocketHandler(io)
        wsHandler.emitGenerationError({
          meetingId,
          error: error.message || '处理失败',
          timestamp: new Date().toISOString()
        })
      }

      res.status(500).json({
        success: false,
        message: error.message || '处理音频失败,请稍后重试'
      })
    }
  }
)

/**
 * 手动触发会议纪要生成
 * POST /api/meetings/:meetingId/generate-minutes
 */
export const triggerMinutesGeneration = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const userId = req.user!._id
    const { options = {} } = req.body

    try {
      // 查找会议
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

      logger.info(`手动触发会议纪要生成: ${meetingId}`)

      // 获取WebSocket实例并发送进度
      const io = getSocketIO()
      let wsHandler: MinutesWebSocketHandler | null = null

      if (io) {
        wsHandler = new MinutesWebSocketHandler(io)
        wsHandler.emitGenerationStarted(meetingId)
      }

      // 先启动模拟三阶段进度，不等待完成
      const simulationPromise = wsHandler
        ? wsHandler.simulateGenerationStages(meetingId).catch(err => {
            logger.error('模拟生成阶段失败:', err)
          })
        : Promise.resolve()

      // 生成纪要
      const minutesResult = await minutesGenerationService.generateMinutes(meeting, options)

      // 保存纪要
      await minutesGenerationService.saveMinutesToMeeting(meeting, minutesResult)

      // 等待模拟阶段完成后再发送完成事件
      await simulationPromise

      // 发送完成事件
      if (wsHandler) {
        wsHandler.emitGenerationCompleted({
          meetingId,
          minutesId: meeting.minutes?.id || '',
          minutes: meeting.minutes,
          timestamp: new Date().toISOString()
        })
      }

      logger.info('会议纪要生成成功')

      res.json({
        success: true,
        message: '会议纪要生成成功',
        data: {
          minutes: meeting.minutes,
          result: minutesResult
        }
      })
    } catch (error: any) {
      logger.error('生成会议纪要失败:', error)

      // 发送错误事件
      const io = getSocketIO()
      if (io) {
        const wsHandler = new MinutesWebSocketHandler(io)
        wsHandler.emitGenerationError({
          meetingId,
          error: error.message || '生成失败',
          timestamp: new Date().toISOString()
        })
      }

      res.status(500).json({
        success: false,
        message: error.message || '生成会议纪要失败'
      })
    }
  }
)
