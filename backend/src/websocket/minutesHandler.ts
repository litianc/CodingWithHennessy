// @ts-nocheck
/**
 * WebSocket 会议纪要生成实时反馈处理器
 * 处理纪要生成过程中的进度更新和状态通知
 */

import { Server as SocketIOServer, Socket } from 'socket.io'
import { logger } from '@/utils/logger'

export interface MinutesGenerationProgress {
  meetingId: string
  stage: 'thinking' | 'searching' | 'writing'
  progress: number
  message: string
  timestamp: string
}

export interface MinutesGenerationResult {
  meetingId: string
  minutesId: string
  minutes: any
  timestamp: string
}

export interface MinutesGenerationError {
  meetingId: string
  error: string
  timestamp: string
}

export class MinutesWebSocketHandler {
  private io: SocketIOServer

  constructor(io: SocketIOServer) {
    this.io = io
    this.setupEventHandlers()
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`客户端连接: ${socket.id}`)

      // 加入会议房间
      socket.on('join-meeting', (meetingId: string) => {
        if (!meetingId) {
          socket.emit('error', { message: '无效的会议ID' })
          return
        }

        socket.join(`meeting-${meetingId}`)
        socket.emit('joined-meeting', {
          meetingId,
          message: '成功加入会议房间'
        })

        logger.info(`客户端 ${socket.id} 加入会议房间: meeting-${meetingId}`)
      })

      // 离开会议房间
      socket.on('leave-meeting', (meetingId: string) => {
        socket.leave(meetingId)
        socket.emit('left-meeting', {
          meetingId,
          message: '已离开会议房间'
        })

        logger.info(`客户端 ${socket.id} 离开会议房间: ${meetingId}`)
      })

      // 断开连接
      socket.on('disconnect', () => {
        logger.info(`客户端断开连接: ${socket.id}`)
      })
    })
  }

  /**
   * 发送纪要生成开始事件
   */
  emitGenerationStarted(meetingId: string): void {
    this.io.to(`meeting-${meetingId}`).emit('minutes-generation-started', {
      meetingId,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要生成开始事件: ${meetingId}`)
  }

  /**
   * 发送纪要生成进度事件
   */
  emitGenerationProgress(data: MinutesGenerationProgress): void {
    const { meetingId, stage, progress, message } = data

    let eventName: string
    switch (stage) {
      case 'thinking':
        eventName = 'minutes-generation-thinking'
        break
      case 'searching':
        eventName = 'minutes-generation-searching'
        break
      case 'writing':
        eventName = 'minutes-generation-writing'
        break
      default:
        eventName = 'minutes-generation-progress'
    }

    this.io.to(`meeting-${meetingId}`).emit(eventName, {
      meetingId,
      stage,
      progress,
      message,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要生成进度: ${meetingId} - ${stage} (${progress}%)`)
  }

  /**
   * 发送纪要生成完成事件
   */
  emitGenerationCompleted(data: MinutesGenerationResult): void {
    this.io.to(`meeting-${data.meetingId}`).emit('minutes-generated', {
      ...data,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要生成完成事件: ${data.meetingId}`)
  }

  /**
   * 发送纪要生成错误事件
   */
  emitGenerationError(data: MinutesGenerationError): void {
    this.io.to(`meeting-${data.meetingId}`).emit('minutes-generation-error', {
      ...data,
      timestamp: new Date().toISOString()
    })

    logger.error(`发送纪要生成错误事件: ${data.meetingId} - ${data.error}`)
  }

  /**
   * 发送纪要优化开始事件
   */
  emitOptimizationStarted(meetingId: string, feedback: string): void {
    this.io.to(meetingId).emit('minutes-optimization-started', {
      meetingId,
      feedback,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要优化开始事件: ${meetingId}`)
  }

  /**
   * 发送纪要优化完成事件
   */
  emitOptimizationCompleted(data: MinutesGenerationResult): void {
    this.io.to(data.meetingId).emit('minutes-optimized', {
      ...data,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要优化完成事件: ${data.meetingId}`)
  }

  /**
   * 发送纪要批准事件
   */
  emitMinutesApproved(meetingId: string, minutesId: string, approver: any): void {
    this.io.to(meetingId).emit('minutes-approved', {
      meetingId,
      minutesId,
      approver,
      timestamp: new Date().toISOString()
    })

    logger.info(`发送纪要批准事件: ${meetingId}`)
  }

  /**
   * 模拟纪要生成的三阶段过程
   * 用于演示和测试
   */
  async simulateGenerationStages(meetingId: string): Promise<void> {
    // 阶段1: AI思考
    await new Promise(resolve => setTimeout(resolve, 1000))
    this.emitGenerationProgress({
      meetingId,
      stage: 'thinking',
      progress: 33,
      message: 'AI正在分析会议内容...',
      timestamp: new Date().toISOString()
    })

    // 阶段2: 搜索资料
    await new Promise(resolve => setTimeout(resolve, 1500))
    this.emitGenerationProgress({
      meetingId,
      stage: 'searching',
      progress: 66,
      message: '正在搜索相关资料...',
      timestamp: new Date().toISOString()
    })

    // 阶段3: 生成纪要
    await new Promise(resolve => setTimeout(resolve, 2000))
    this.emitGenerationProgress({
      meetingId,
      stage: 'writing',
      progress: 90,
      message: '正在生成会议纪要...',
      timestamp: new Date().toISOString()
    })
  }
}

// 导出工厂函数
export function createMinutesWebSocketHandler(io: SocketIOServer): MinutesWebSocketHandler {
  return new MinutesWebSocketHandler(io)
}
