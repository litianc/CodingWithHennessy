/**
 * FunASR 语音识别服务客户端
 *
 * 提供文件转录和实时转录功能
 */
import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs/promises'
import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { logger } from '@/utils/logger'
import type {
  TranscriptionOptions,
  TranscriptionResult,
  RealTimeTranscriptionEvent
} from './speechRecognitionService'

export interface FunASRConfig {
  serviceUrl: string
  wsUrl: string
  timeout: number
  maxRetries: number
}

export class FunASRService {
  private config: FunASRConfig
  private httpClient: AxiosInstance

  constructor(config: FunASRConfig) {
    this.config = config

    // 创建 HTTP 客户端
    this.httpClient = axios.create({
      baseURL: config.serviceUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    logger.info('FunASR 服务初始化完成', {
      serviceUrl: config.serviceUrl,
      wsUrl: config.wsUrl
    })
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/health')
      return response.status === 200 && response.data?.status === 'ok'
    } catch (error) {
      logger.error('FunASR 健康检查失败:', error)
      return false
    }
  }

  /**
   * 从文件转录
   */
  async recognizeFromFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    try {
      logger.info(`FunASR 文件转录开始: ${filePath}`)

      // 准备表单数据
      const formData = new FormData()

      // 读取音频文件
      const audioBuffer = await fs.readFile(filePath)
      formData.append('audio', audioBuffer, {
        filename: filePath.split('/').pop() || 'audio.wav',
        contentType: this.getAudioContentType(options.format || 'wav')
      })

      // 添加配置参数
      formData.append('format', options.format || 'wav')
      formData.append('sample_rate', String(options.sampleRate || 16000))
      formData.append('language', options.language || 'zh-cn')

      if (options.enablePunctuation !== undefined) {
        formData.append('enable_punctuation', String(options.enablePunctuation))
      }

      if (options.enableInverseTextNormalization !== undefined) {
        formData.append('enable_itn', String(options.enableInverseTextNormalization))
      }

      // 发送请求
      const response = await this.httpClient.post('/api/recognize', formData, {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      // 解析响应
      if (response.data?.success && response.data?.text !== undefined) {
        const transcriptionResult: TranscriptionResult = {
          text: response.data.text || '',
          confidence: 0.95, // FunASR doesn't return confidence, use default
          startTime: 0,
          endTime: response.data.duration ? response.data.duration * 1000 : 0
        }

        logger.info(`FunASR 转录成功: ${transcriptionResult.text.substring(0, 50)}...`)

        return [transcriptionResult]
      } else {
        throw new Error(`FunASR API 返回错误: ${response.data?.error || '未知错误'}`)
      }

    } catch (error: any) {
      logger.error('FunASR 文件转录失败:', error)
      throw new Error(`FunASR 转录失败: ${error.message}`)
    }
  }

  /**
   * 创建实时转录会话
   */
  async createRealTimeSession(
    options: TranscriptionOptions = {}
  ): Promise<FunASRRealTimeSession> {
    logger.info('创建 FunASR 实时转录会话')

    const session = new FunASRRealTimeSession(this.config.wsUrl, options)

    return session
  }

  /**
   * 获取音频 MIME 类型
   */
  private getAudioContentType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'pcm': 'audio/pcm',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    }

    return mimeTypes[format.toLowerCase()] || 'audio/wav'
  }
}

/**
 * FunASR 实时转录会话
 */
export class FunASRRealTimeSession extends EventEmitter {
  private ws: WebSocket | null = null
  private wsUrl: string
  private options: TranscriptionOptions
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 3
  private reconnectDelay: number = 1000

  constructor(wsUrl: string, options: TranscriptionOptions) {
    super()
    this.wsUrl = wsUrl
    this.options = options
  }

  /**
   * 连接到 FunASR WebSocket 服务
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`连接到 FunASR WebSocket: ${this.wsUrl}`)

        this.ws = new WebSocket(this.wsUrl)

        this.ws.on('open', () => {
          logger.info('FunASR WebSocket 连接成功')
          this.isConnected = true
          this.reconnectAttempts = 0

          // 发送配置消息
          this.sendConfig()

          resolve()
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data)
        })

        this.ws.on('error', (error: Error) => {
          logger.error('FunASR WebSocket 错误:', error)
          this.isConnected = false
          this.emit('error', error)

          if (!this.isConnected) {
            reject(error)
          }
        })

        this.ws.on('close', () => {
          logger.info('FunASR WebSocket 连接关闭')
          this.isConnected = false
          this.handleReconnect()
        })

      } catch (error) {
        logger.error('FunASR WebSocket 连接失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 发送配置消息
   */
  private sendConfig(): void {
    if (!this.ws || !this.isConnected) return

    const config = {
      type: 'start',
      data: {
        format: this.options.format || 'pcm',
        sample_rate: this.options.sampleRate || 16000,
        language: this.options.language || 'zh-cn',
        enable_punctuation: this.options.enablePunctuation !== false,
        enable_itn: this.options.enableInverseTextNormalization !== false,
        enable_vad: true
      }
    }

    this.ws.send(JSON.stringify(config))
    logger.debug('发送 FunASR 配置:', config)
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString())

      logger.debug('收到 FunASR 消息:', message)

      switch (message.type) {
        case 'started':
          this.emit('data', {
            type: 'sentence_begin',
            timestamp: Date.now()
          } as RealTimeTranscriptionEvent)
          break

        case 'partial':
        case 'result':
          const event: RealTimeTranscriptionEvent = {
            type: message.type === 'partial' ? 'result_changed' : 'sentence_end',
            result: {
              text: message.data?.text || '',
              confidence: message.data?.confidence || 0.9,
              startTime: message.data?.start_time || 0,
              endTime: message.data?.end_time || 0
            },
            timestamp: Date.now()
          }

          this.emit('data', event)
          break

        case 'completed':
          this.emit('data', {
            type: 'completed',
            timestamp: Date.now()
          } as RealTimeTranscriptionEvent)
          break

        case 'error':
          const error = new Error(message.data?.message || 'FunASR 识别错误')
          this.emit('error', error)
          break
      }

    } catch (error) {
      logger.error('处理 FunASR 消息失败:', error)
      this.emit('error', error as Error)
    }
  }

  /**
   * 发送音频数据
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || !this.isConnected) {
      logger.warn('FunASR WebSocket 未连接，无法发送音频数据')
      return
    }

    try {
      // 将 ArrayBuffer 转换为 Base64
      const buffer = Buffer.from(audioData)
      const base64Audio = buffer.toString('base64')

      const message = {
        type: 'audio',
        data: {
          audio: base64Audio,
          is_final: false
        }
      }

      this.ws.send(JSON.stringify(message))
      logger.debug(`发送音频数据: ${buffer.length} bytes`)

    } catch (error) {
      logger.error('发送音频数据失败:', error)
      this.emit('error', error as Error)
    }
  }

  /**
   * 结束发送（发送最后一帧）
   */
  finish(): void {
    if (!this.ws || !this.isConnected) return

    try {
      const message = {
        type: 'audio',
        data: {
          audio: '',
          is_final: true
        }
      }

      this.ws.send(JSON.stringify(message))
      logger.debug('发送音频结束标记')

    } catch (error) {
      logger.error('发送结束标记失败:', error)
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.isConnected = false
      this.ws.close()
      this.ws = null
      logger.info('FunASR WebSocket 连接已关闭')
    }
  }

  /**
   * 处理重连
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('FunASR WebSocket 重连次数超过限制')
      this.emit('error', new Error('WebSocket 重连失败'))
      return
    }

    this.reconnectAttempts++

    logger.info(`FunASR WebSocket 将在 ${this.reconnectDelay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch(error => {
        logger.error('FunASR WebSocket 重连失败:', error)
      })
    }, this.reconnectDelay)

    // 指数退避
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000)
  }

  /**
   * 设置事件回调（兼容旧接口）
   */
  on(event: 'data' | 'error', callback: (data: any) => void): this {
    return super.on(event, callback)
  }
}

// 创建服务实例
export const funasrService = new FunASRService({
  serviceUrl: process.env.FUNASR_SERVICE_URL || 'http://localhost:10095',
  wsUrl: process.env.FUNASR_WS_URL || 'ws://localhost:10096',
  timeout: parseInt(process.env.FUNASR_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.FUNASR_MAX_RETRIES || '3')
})
