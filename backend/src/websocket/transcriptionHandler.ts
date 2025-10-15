import { Server as SocketIOServer, Socket } from 'socket.io'
import { authenticateSocket } from '@/middleware/socketAuth'
import { Meeting } from '@/models/Meeting'
import { speechService } from '@/services/speechRecognitionService'
import { logger } from '@/utils/logger'

interface TranscriptionSession {
  meetingId: string
  userId: string
  socketId: string
  session?: any // RealTimeTranscriptionSession
  isActive: boolean
}

// 存储活跃的转录会话
const activeSessions = new Map<string, TranscriptionSession>()

export const setupTranscriptionHandlers = (io: SocketIOServer) => {
  io.use(authenticateSocket)

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).user._id

    logger.info(`用户连接到转录服务: ${userId} (${socket.id})`)

    // 开始实时转录
    socket.on('start-transcription', async (data: { meetingId: string; options?: any }) => {
      try {
        const { meetingId, options = {} } = data

        // 验证会议权限
        const meeting = await Meeting.findById(meetingId)
        if (!meeting) {
          socket.emit('error', { message: '会议不存在' })
          return
        }

        if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
          socket.emit('error', { message: '无权限访问此会议' })
          return
        }

        if (meeting.status !== 'in_progress') {
          socket.emit('error', { message: '会议未开始' })
          return
        }

        if (!meeting.settings.enableTranscription) {
          socket.emit('error', { message: '此会议未启用转录功能' })
          return
        }

        // 检查是否已有活跃的转录会话
        const existingSession = Array.from(activeSessions.values())
          .find(session => session.meetingId === meetingId && session.isActive)

        if (existingSession) {
          socket.emit('error', { message: '此会议已有活跃的转录会话' })
          return
        }

        // 加入会议房间
        socket.join(`meeting-${meetingId}`)

        // 创建转录会话
        const session = await speechService.createRealTimeSession({
          language: meeting.settings.language,
          enablePunctuation: true,
          enableInverseTextNormalization: true,
          enableSpeakerDiarization: meeting.settings.enableVoiceprint,
          speakerCount: meeting.participants.length,
          ...options
        })

        // 存储会话信息
        const sessionId = `${meetingId}-${userId}`
        activeSessions.set(sessionId, {
          meetingId,
          userId,
          socketId: socket.id,
          session,
          isActive: true
        })

        // 设置事件监听
        session.on('data', (event: any) => {
          handleTranscriptionEvent(socket, meetingId, event)
        })

        session.on('error', (error: Error) => {
          logger.error(`转录会话错误: ${meetingId}`, error)
          socket.emit('transcription-error', {
            meetingId,
            error: error.message
          })
        })

        // 连接到语音识别服务
        await session.connect()

        socket.emit('transcription-started', { meetingId })
        logger.info(`实时转录开始: ${meetingId} by ${userId}`)

      } catch (error) {
        logger.error('启动实时转录失败:', error)
        socket.emit('error', { message: '启动转录失败' })
      }
    })

    // 发送音频数据
    socket.on('audio-chunk', async (data: { meetingId: string; audioData: string }) => {
      try {
        const { meetingId, audioData } = data
        const sessionId = `${meetingId}-${userId}`
        const session = activeSessions.get(sessionId)

        if (!session || !session.isActive) {
          socket.emit('error', { message: '转录会话不存在或已停止' })
          return
        }

        // 将Base64音频数据转换为ArrayBuffer
        const audioBuffer = Buffer.from(audioData, 'base64')
        session.session?.sendAudio(audioBuffer.buffer)

      } catch (error) {
        logger.error('处理音频数据失败:', error)
        socket.emit('error', { message: '处理音频数据失败' })
      }
    })

    // 停止实时转录
    socket.on('stop-transcription', async (data: { meetingId: string }) => {
      try {
        const { meetingId } = data
        const sessionId = `${meetingId}-${userId}`
        const session = activeSessions.get(sessionId)

        if (session && session.isActive) {
          // 关闭转录会话
          session.session?.close()
          session.isActive = false

          // 离开会议房间
          socket.leave(`meeting-${meetingId}`)

          socket.emit('transcription-stopped', { meetingId })
          logger.info(`实时转录停止: ${meetingId} by ${userId}`)
        }

      } catch (error) {
        logger.error('停止实时转录失败:', error)
        socket.emit('error', { message: '停止转录失败' })
      }
    })

    // 断开连接时清理会话
    socket.on('disconnect', () => {
      const userSessions = Array.from(activeSessions.entries())
        .filter(([_, session]) => session.socketId === socket.id)

      userSessions.forEach(([sessionId, session]) => {
        if (session.isActive) {
          session.session?.close()
          session.isActive = false
          logger.info(`用户断开连接，清理转录会话: ${session.meetingId}`)
        }
        activeSessions.delete(sessionId)
      })

      logger.info(`用户断开转录服务连接: ${userId} (${socket.id})`)
    })
  })
}

/**
 * 处理转录事件
 */
function handleTranscriptionEvent(socket: Socket, meetingId: string, event: any) {
  switch (event.type) {
    case 'sentence_begin':
      socket.emit('transcription-sentence-begin', {
        meetingId,
        timestamp: event.timestamp
      })
      break

    case 'result_changed':
      socket.emit('transcription-intermediate', {
        meetingId,
        result: event.result,
        timestamp: event.timestamp
      })
      break

    case 'sentence_end':
      if (event.result) {
        // 保存最终转录结果到数据库
        saveTranscriptionResult(meetingId, event.result)
          .then(() => {
            // 广播给会议中的所有用户
            socket.to(`meeting-${meetingId}`).emit('transcription-updated', {
              meetingId,
              result: event.result,
              timestamp: event.timestamp
            })

            // 发送给当前用户
            socket.emit('transcription-completed', {
              meetingId,
              result: event.result,
              timestamp: event.timestamp
            })
          })
          .catch(error => {
            logger.error('保存转录结果失败:', error)
            socket.emit('error', { message: '保存转录结果失败' })
          })
      }
      break

    case 'completed':
      socket.emit('transcription-session-completed', {
        meetingId,
        timestamp: event.timestamp
      })
      break
  }
}

/**
 * 保存转录结果到数据库
 */
async function saveTranscriptionResult(meetingId: string, result: any) {
  try {
    const meeting = await Meeting.findById(meetingId)
    if (!meeting) {
      throw new Error('会议不存在')
    }

    meeting.addTranscription(
      result.speakerId || 'unknown',
      result.speakerName || '未知说话人',
      result.text,
      result.confidence,
      result.startTime,
      result.endTime
    )

    await meeting.save()
    logger.debug(`转录结果已保存: ${meetingId}`)
  } catch (error) {
    logger.error('保存转录结果失败:', error)
    throw error
  }
}

/**
 * 获取活跃的转录会话
 */
export function getActiveTranscriptionSessions(): TranscriptionSession[] {
  return Array.from(activeSessions.values()).filter(session => session.isActive)
}

/**
 * 获取会议的转录会话
 */
export function getMeetingTranscriptionSession(meetingId: string): TranscriptionSession | null {
  const sessions = Array.from(activeSessions.values())
    .filter(session => session.meetingId === meetingId && session.isActive)

  return sessions.length > 0 ? sessions[0] : null
}