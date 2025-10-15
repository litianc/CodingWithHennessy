// @ts-nocheck
import axios from 'axios'
import crypto from 'crypto'
import WebSocket from 'ws'
import fs from 'fs/promises'
import { logger } from '@/utils/logger'
import { audioService } from './audioService'

export interface SpeechRecognitionConfig {
  appKey: string
  accessKeyId: string
  accessKeySecret: string
  region: string
}

export interface TranscriptionOptions {
  language?: string
  format?: string
  sampleRate?: number
  enablePunctuation?: boolean
  enableInverseTextNormalization?: boolean
  enableSpeakerDiarization?: boolean
  speakerCount?: number
}

export interface TranscriptionResult {
  text: string
  confidence: number
  speakerId?: string
  speakerName?: string
  startTime: number
  endTime: number
  words?: Array<{
    word: string
    startTime: number
    endTime: number
    confidence: number
  }>
}

export interface RealTimeTranscriptionEvent {
  type: 'sentence_begin' | 'sentence_end' | 'result_changed' | 'completed'
  result?: TranscriptionResult
  timestamp: number
}

export class AlibabaCloudSpeechService {
  private config: SpeechRecognitionConfig
  private token: string | null = null
  private tokenExpireTime: number = 0

  constructor(config: SpeechRecognitionConfig) {
    this.config = config
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    // 检查令牌是否仍然有效
    if (this.token && Date.now() < this.tokenExpireTime) {
      return this.token
    }

    try {
      const url = 'https://nls-meta.cn-shanghai.aliyuncs.com/oauth/token'
      const params = {
        grant_type: 'client_credentials',
        client_id: this.config.accessKeyId,
        client_secret: this.config.accessKeySecret
      }

      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      if (response.data && response.data.access_token) {
        this.token = response.data.access_token
        // 令牌有效期减去5分钟缓冲
        this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000
        return this.token
      } else {
        throw new Error('获取访问令牌失败')
      }
    } catch (error) {
      logger.error('获取阿里云访问令牌失败:', error)
      throw new Error('获取访问令牌失败')
    }
  }

  /**
   * 文件语音识别（非实时）
   */
  async recognizeFromFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    const accessToken = await this.getAccessToken()

    const defaultOptions: TranscriptionOptions = {
      language: 'zh-CN',
      format: 'wav',
      sampleRate: 16000,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
      enableSpeakerDiarization: false,
      speakerCount: 1,
      ...options
    }

    try {
      // 读取音频文件
      const audioBuffer = await fs.promises.readFile(filePath)
      const audioBase64 = audioBuffer.toString('base64')

      // 构建请求
      const request = {
        url: 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-NLS-Token': accessToken
        },
        data: {
          format: defaultOptions.format,
          sample_rate: defaultOptions.sampleRate,
          language: defaultOptions.language,
          enable_punctuation: defaultOptions.enablePunctuation,
          enable_inverse_text_normalization: defaultOptions.enableInverseTextNormalization,
          enable_speaker_diarization: defaultOptions.enableSpeakerDiarization,
          speaker_count: defaultOptions.speakerCount,
          enable_sample_rate_adaptive: true,
            model: 'paraformer-v1',
            vocabulary_id: '',
            disfluency: true,
            audio: audioBase64
          }
        }

      const response = await axios(request)

      if (response.data && response.data.output) {
        return this.parseTranscriptionResults(response.data.output)
      } else {
        throw new Error('语音识别结果格式错误')
      }
    } catch (error) {
      logger.error('文件语音识别失败:', error)
      throw new Error('语音识别失败')
    }
  }

  /**
   * 实时语音识别
   */
  async createRealTimeSession(
    options: TranscriptionOptions = {}
  ): Promise<RealTimeTranscriptionSession> {
    const accessToken = await this.getAccessToken()

    const defaultOptions: TranscriptionOptions = {
      language: 'zh-CN',
      format: 'wav',
      sampleRate: 16000,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
      enableSpeakerDiarization: false,
      speakerCount: 1,
      ...options
    }

    return new RealTimeTranscriptionSession(accessToken, defaultOptions, this.config)
  }

  /**
   * 解析转录结果
   */
  private parseTranscriptionResults(output: any): TranscriptionResult[] {
    const results: TranscriptionResult[] = []

    if (output.sentence) {
      // 单句结果
      const sentence = output.sentence
      results.push({
        text: sentence.text || '',
        confidence: sentence.confidence || 0,
        speakerId: sentence.speaker_id,
        speakerName: sentence.speaker_name,
        startTime: sentence.begin_time || 0,
        endTime: sentence.end_time || 0,
        words: sentence.words
      })
    } else if (output.sentences && Array.isArray(output.sentences)) {
      // 多句结果
      output.sentences.forEach((sentence: any) => {
        results.push({
          text: sentence.text || '',
          confidence: sentence.confidence || 0,
          speakerId: sentence.speaker_id,
          speakerName: sentence.speaker_name,
          startTime: sentence.begin_time || 0,
          endTime: sentence.end_time || 0,
          words: sentence.words
        })
      })
    }

    return results
  }
}

/**
 * 实时语音识别会话
 */
export class RealTimeTranscriptionSession {
  private accessToken: string
  private options: TranscriptionOptions
  private config: SpeechRecognitionConfig
  private ws: WebSocket | null = null
  private isConnected: boolean = false
  private onEvent?: (event: RealTimeTranscriptionEvent) => void
  private onError?: (error: Error) => void

  constructor(accessToken: string, options: TranscriptionOptions, config: SpeechRecognitionConfig) {
    this.accessToken = accessToken
    this.options = options
    this.config = config
  }

  /**
   * 连接到实时语音识别服务
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1/asr?token=${this.accessToken}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          this.isConnected = true
          this.sendStartMessage()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          this.isConnected = false
          const err = new Error('WebSocket连接失败')
          this.onError?.(err)
          reject(err)
        }

        this.ws.onclose = () => {
          this.isConnected = false
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 发送开始消息
   */
  private sendStartMessage(): void {
    if (!this.ws || !this.isConnected) return

    const startMessage = {
      header: {
        message_id: this.generateMessageId(),
        task_id: this.generateTaskId(),
        namespace: 'SpeechTranscriber',
        name: 'StartTranscription',
        appkey: this.config.appKey
      },
      payload: {
        format: this.options.format,
        sample_rate: this.options.sampleRate,
        language: this.options.language,
        enable_punctuation: this.options.enablePunctuation,
        enable_inverse_text_normalization: this.options.enableInverseTextNormalization,
        enable_speaker_diarization: this.options.enableSpeakerDiarization,
        speaker_count: this.options.speakerCount,
        enable_sample_rate_adaptive: true,
        model: 'paraformer-v1',
        enable_intermediate_result: true
      }
    }

    this.ws.send(JSON.stringify(startMessage))
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      if (message.header) {
        const eventName = message.header.name

        switch (eventName) {
          case 'TranscriptionStarted':
            logger.info('实时语音识别会话已启动')
            break

          case 'SentenceBegin':
            this.onEvent?.({
              type: 'sentence_begin',
              timestamp: Date.now()
            })
            break

          case 'TranscriptionResultChanged':
          case 'SentenceEnd':
            const event: RealTimeTranscriptionEvent = {
              type: eventName === 'TranscriptionResultChanged' ? 'result_changed' : 'sentence_end',
              timestamp: Date.now()
            }

            if (message.payload && message.payload.result) {
              event.result = this.parseRealtimeResult(message.payload.result)
            }

            this.onEvent?.(event)
            break

          case 'TranscriptionCompleted':
            this.onEvent?.({
              type: 'completed',
              timestamp: Date.now()
            })
            this.close()
            break
        }
      }
    } catch (error) {
      logger.error('处理实时语音识别消息失败:', error)
      this.onError?.(error as Error)
    }
  }

  /**
   * 解析实时识别结果
   */
  private parseRealtimeResult(result: any): TranscriptionResult {
    return {
      text: result.text || '',
      confidence: result.confidence || 0,
      speakerId: result.speaker_id,
      speakerName: result.speaker_name,
      startTime: result.begin_time || 0,
      endTime: result.end_time || 0,
      words: result.words
    }
  }

  /**
   * 发送音频数据
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || !this.isConnected) return

    const message = {
      header: {
        message_id: this.generateMessageId(),
        task_id: this.generateTaskId(),
        namespace: 'SpeechTranscriber',
        name: 'SendAudio',
        appkey: this.config.appKey
      },
      payload: {
        audio: Buffer.from(audioData).toString('base64'),
        status: 1 // 1表示中间音频，2表示最后一片音频
      }
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * 设置事件回调
   */
  on(event: 'data' | 'error', callback: (data: any) => void): void {
    if (event === 'data') {
      this.onEvent = callback as (event: RealTimeTranscriptionEvent) => void
    } else if (event === 'error') {
      this.onError = callback as (error: Error) => void
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws && this.isConnected) {
      this.sendStopMessage()
      this.ws.close()
      this.isConnected = false
    }
  }

  /**
   * 发送停止消息
   */
  private sendStopMessage(): void {
    if (!this.ws || !this.isConnected) return

    const stopMessage = {
      header: {
        message_id: this.generateMessageId(),
        task_id: this.generateTaskId(),
        namespace: 'SpeechTranscriber',
        name: 'StopTranscription',
        appkey: this.config.appKey
      },
      payload: {}
    }

    this.ws.send(JSON.stringify(stopMessage))
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return crypto.randomUUID()
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return crypto.randomUUID()
  }
}

// 创建服务实例
export const speechService = new AlibabaCloudSpeechService({
  appKey: process.env.ALIBABA_CLOUD_APP_KEY || '',
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  region: process.env.ALIBABA_CLOUD_REGION || 'cn-shanghai'
})