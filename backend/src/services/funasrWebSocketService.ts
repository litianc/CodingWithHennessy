/**
 * FunASR WebSocket 服务 - 真实协议实现
 *
 * 基于 FunASR 官方 WebSocket 协议
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { logger } from '@/utils/logger'
import fs from 'fs/promises'
import path from 'path'

export interface FunASRWebSocketConfig {
  wsUrl: string
  mode?: 'offline' | 'online' | '2pass'
  audioFormat?: 'pcm' | 'wav'
  audioSampleRate?: number
  chunkSize?: [number, number, number] // [5, 10, 5]
  chunkInterval?: number // 10
}

export interface FunASRMessage {
  mode: string
  chunk_size: [number, number, number]
  chunk_interval: number
  wav_name: string
  is_speaking: boolean
  wav_format: string
  audio_fs: number
}

export interface FunASRResult {
  is_final: boolean
  mode: string
  text: string
  timestamp: string // JSON array of [start, end] pairs
  stamp_sents: Array<{
    text_seg: string
    start: number
    end: number
    punc: string
    ts_list: number[][]
  }>
  wav_name: string
}

/**
 * FunASR WebSocket 会话
 */
export class FunASRWebSocketSession extends EventEmitter {
  private ws: WebSocket | null = null
  private config: FunASRWebSocketConfig
  private isConnected: boolean = false
  private sessionId: string
  private audioBuffer: Buffer[] = []

  constructor(config: FunASRWebSocketConfig) {
    super()
    this.config = {
      mode: 'offline',
      audioFormat: 'pcm',
      audioSampleRate: 16000,
      chunkSize: [5, 10, 5],
      chunkInterval: 10,
      ...config
    }
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * 连接到 FunASR WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`[FunASR] 连接到 WebSocket: ${this.config.wsUrl}`)

        this.ws = new WebSocket(this.config.wsUrl)

        this.ws.on('open', () => {
          logger.info('[FunASR] WebSocket 连接成功')
          this.isConnected = true
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data)
        })

        this.ws.on('error', (error: Error) => {
          logger.error('[FunASR] WebSocket 错误:', error)
          this.isConnected = false
          this.emit('error', error)

          if (!this.isConnected) {
            reject(error)
          }
        })

        this.ws.on('close', () => {
          logger.info('[FunASR] WebSocket 连接关闭')
          this.isConnected = false
          this.emit('closed')
        })

      } catch (error) {
        logger.error('[FunASR] WebSocket 连接失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 从文件转录
   */
  async transcribeFile(audioPath: string): Promise<FunASRResult | null> {
    try {
      logger.info(`[FunASR] 开始转录文件: ${audioPath}`)

      if (!this.isConnected || !this.ws) {
        throw new Error('WebSocket 未连接')
      }

      // 读取音频文件
      const audioData = await fs.readFile(audioPath)
      logger.info(`[FunASR] 音频文件大小: ${audioData.length} bytes`)

      // 发送开始消息
      const startMessage: FunASRMessage = {
        mode: this.config.mode!,
        chunk_size: this.config.chunkSize!,
        chunk_interval: this.config.chunkInterval!,
        wav_name: path.basename(audioPath),
        is_speaking: true,
        wav_format: this.config.audioFormat!,
        audio_fs: this.config.audioSampleRate!
      }

      logger.debug('[FunASR] 发送开始消息:', startMessage)
      this.ws.send(JSON.stringify(startMessage))

      // 等待一小段时间让服务器准备
      await new Promise(resolve => setTimeout(resolve, 100))

      // 发送音频数据（二进制）
      logger.info(`[FunASR] 发送音频数据: ${audioData.length} bytes`)
      this.ws.send(audioData)

      // 等待音频数据发送完成
      await new Promise(resolve => setTimeout(resolve, 100))

      // 发送结束消息
      const endMessage = {
        is_speaking: false
      }

      logger.debug('[FunASR] 发送结束消息:', endMessage)
      this.ws.send(JSON.stringify(endMessage))

      // 等待识别结果
      return await this.waitForResult(60000) // 60秒超时

    } catch (error) {
      logger.error('[FunASR] 文件转录失败:', error)
      throw error
    }
  }

  /**
   * 发送音频流数据
   */
  async sendAudioStream(audioBuffer: Buffer, isFirst: boolean = false, isFinal: boolean = false): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未连接')
    }

    try {
      // 第一次发送时，先发送配置消息
      if (isFirst) {
        const startMessage: FunASRMessage = {
          mode: this.config.mode!,
          chunk_size: this.config.chunkSize!,
          chunk_interval: this.config.chunkInterval!,
          wav_name: this.sessionId,
          is_speaking: true,
          wav_format: this.config.audioFormat!,
          audio_fs: this.config.audioSampleRate!
        }

        logger.debug('[FunASR] 发送流配置消息:', startMessage)
        this.ws.send(JSON.stringify(startMessage))

        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 发送音频数据
      if (audioBuffer.length > 0) {
        logger.debug(`[FunASR] 发送音频块: ${audioBuffer.length} bytes`)
        this.ws.send(audioBuffer)
      }

      // 最后一次发送时，发送结束标记
      if (isFinal) {
        await new Promise(resolve => setTimeout(resolve, 100))

        const endMessage = {
          is_speaking: false
        }

        logger.debug('[FunASR] 发送流结束消息:', endMessage)
        this.ws.send(JSON.stringify(endMessage))
      }

    } catch (error) {
      logger.error('[FunASR] 发送音频流失败:', error)
      throw error
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = data.toString()

      // 尝试解析为 JSON
      try {
        const result = JSON.parse(message) as FunASRResult

        logger.debug('[FunASR] 收到识别结果:', {
          is_final: result.is_final,
          text_length: result.text?.length || 0,
          segments: result.stamp_sents?.length || 0
        })

        this.emit('result', result)

        // 如果是最终结果，触发完成事件
        if (result.is_final) {
          this.emit('completed', result)
        }

      } catch (parseError) {
        // 如果不是 JSON，可能是其他类型的消息
        logger.debug('[FunASR] 收到非 JSON 消息:', message.substring(0, 100))
      }

    } catch (error) {
      logger.error('[FunASR] 处理消息失败:', error)
      this.emit('error', error)
    }
  }

  /**
   * 等待识别结果
   */
  private waitForResult(timeout: number = 30000): Promise<FunASRResult | null> {
    return new Promise((resolve, reject) => {
      let latestResult: FunASRResult | null = null
      let noMoreDataTimer: NodeJS.Timeout | null = null

      const timer = setTimeout(() => {
        reject(new Error('等待识别结果超时'))
      }, timeout)

      const resultHandler = (result: FunASRResult) => {
        latestResult = result

        // 如果是最终结果，立即返回
        if (result.is_final) {
          clearTimeout(timer)
          if (noMoreDataTimer) clearTimeout(noMoreDataTimer)
          this.off('result', resultHandler)
          this.off('error', errorHandler)
          resolve(result)
          return
        }

        // 否则，设置一个2秒的定时器
        // 如果2秒内没有新的消息，就使用当前结果
        if (noMoreDataTimer) {
          clearTimeout(noMoreDataTimer)
        }

        noMoreDataTimer = setTimeout(() => {
          if (latestResult) {
            logger.info('[FunASR] 2秒内未收到新消息，使用当前结果')
            clearTimeout(timer)
            this.off('result', resultHandler)
            this.off('error', errorHandler)
            resolve(latestResult)
          }
        }, 2000)
      }

      const errorHandler = (error: Error) => {
        clearTimeout(timer)
        if (noMoreDataTimer) clearTimeout(noMoreDataTimer)
        this.off('result', resultHandler)
        this.off('error', errorHandler)
        reject(error)
      }

      this.on('result', resultHandler)
      this.on('error', errorHandler)
    })
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.isConnected = false
      this.ws.close()
      this.ws = null
      logger.info('[FunASR] WebSocket 连接已关闭')
    }
  }
}

/**
 * FunASR WebSocket 服务包装器
 */
export class FunASRWebSocketService {
  private config: FunASRWebSocketConfig

  constructor(wsUrl: string) {
    this.config = {
      wsUrl,
      mode: 'offline',
      audioFormat: 'pcm',
      audioSampleRate: 16000,
      chunkSize: [5, 10, 5],
      chunkInterval: 10
    }

    logger.info('[FunASR] 服务初始化完成', { wsUrl })
  }

  /**
   * 创建新的转录会话
   */
  createSession(customConfig?: Partial<FunASRWebSocketConfig>): FunASRWebSocketSession {
    const sessionConfig = {
      ...this.config,
      ...customConfig
    }

    return new FunASRWebSocketSession(sessionConfig)
  }

  /**
   * 快速转录文件
   */
  async transcribeFile(audioPath: string): Promise<FunASRResult> {
    const session = this.createSession()

    try {
      await session.connect()
      const result = await session.transcribeFile(audioPath)

      if (!result) {
        throw new Error('未收到识别结果')
      }

      return result

    } finally {
      session.close()
    }
  }
}

// 导出服务实例
export const funasrWebSocketService = new FunASRWebSocketService(
  process.env.FUNASR_WS_URL || 'ws://localhost:10095'
)
