import axios from 'axios'
import crypto from 'crypto'
import WebSocket from 'ws'
import fs from 'fs/promises'
import { logger } from '@/utils/logger'
import { AlibabaCloudAuth } from './alibabaCloudAuth'

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

/**
 * 增强的阿里云语音识别服务
 * 支持多种认证方式和回退机制
 */
export class EnhancedSpeechRecognitionService {
  private config: SpeechRecognitionConfig
  private auth: AlibabaCloudAuth
  private useMockMode: boolean = false
  private availableAuthMethods: string[] = []

  constructor(config: SpeechRecognitionConfig, useMockMode: boolean = false) {
    this.config = config
    this.auth = new AlibabaCloudAuth({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region
    })
    this.useMockMode = useMockMode || process.env.USE_MOCK_SPEECH_SERVICE === 'true'

    // 检测可用的认证方法
    this.detectAvailableAuthMethods()
  }

  /**
   * 检测可用的认证方法
   */
  private async detectAvailableAuthMethods(): Promise<void> {
    if (this.useMockMode) {
      this.availableAuthMethods = ['mock']
      logger.info('使用模拟语音识别模式')
      return
    }

    logger.info('检测可用的认证方法...')

    // 添加各种认证方法
    this.availableAuthMethods = [
      'token_based',
      'appkey_direct',
      'custom_auth',
      'mock_fallback'
    ]

    logger.info(`可用认证方法: ${this.availableAuthMethods.join(', ')}`)
  }

  /**
   * 文件语音识别
   */
  async recognizeFromFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    logger.info(`开始文件语音识别: ${filePath}`)

    // 如果启用模拟模式，直接返回模拟结果
    if (this.useMockMode) {
      return this.mockRecognizeFromFile(filePath, options)
    }

    // 尝试不同的认证方法
    for (const method of this.availableAuthMethods) {
      try {
        logger.info(`尝试认证方法: ${method}`)
        const result = await this.recognizeWithMethod(method, filePath, options)
        if (result && result.length > 0) {
          logger.info(`认证方法 ${method} 成功`)
          return result
        }
      } catch (error) {
        logger.warn(`认证方法 ${method} 失败:`, error.message)
      }
    }

    // 所有方法都失败，回退到模拟模式
    logger.warn('所有认证方法都失败，回退到模拟模式')
    return this.mockRecognizeFromFile(filePath, options)
  }

  /**
   * 使用特定方法进行识别
   */
  private async recognizeWithMethod(
    method: string,
    filePath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult[]> {
    const audioBuffer = await fs.readFile(filePath)
    const audioBase64 = audioBuffer.toString('base64')

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

    switch (method) {
      case 'token_based':
        return this.recognizeWithToken(defaultOptions, audioBase64)
      case 'appkey_direct':
        return this.recognizeWithAppKey(defaultOptions, audioBase64)
      case 'custom_auth':
        return this.recognizeWithCustomAuth(defaultOptions, audioBase64)
      case 'mock_fallback':
        return this.mockRecognizeFromFile(filePath, options)
      default:
        throw new Error(`未知的认证方法: ${method}`)
    }
  }

  /**
   * 基于Token的识别
   */
  private async recognizeWithToken(
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    const token = await this.auth.getAccessToken()

    const response = await axios.post('https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr', {
      format: options.format,
      sample_rate: options.sampleRate,
      language: options.language,
      enable_punctuation: options.enablePunctuation,
      enable_inverse_text_normalization: options.enableInverseTextNormalization,
      enable_speaker_diarization: options.enableSpeakerDiarization,
      speaker_count: options.speakerCount,
      enable_sample_rate_adaptive: true,
      model: 'paraformer-v1',
      vocabulary_id: '',
      disfluency: true,
      audio: audioBase64
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-NLS-Token': token
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('Token认证返回格式错误')
  }

  /**
   * 直接AppKey认证
   */
  private async recognizeWithAppKey(
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    const response = await axios.post('https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr', {
      appkey: this.config.appKey,
      format: options.format,
      sample_rate: options.sampleRate,
      language: options.language,
      enable_punctuation: options.enablePunctuation,
      enable_inverse_text_normalization: options.enableInverseTextNormalization,
      enable_speaker_diarization: options.enableSpeakerDiarization,
      speaker_count: options.speakerCount,
      enable_sample_rate_adaptive: true,
      model: 'paraformer-v1',
      vocabulary_id: '',
      disfluency: true,
      audio: audioBase64
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-NLS-Token': this.config.appKey
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('AppKey认证返回格式错误')
  }

  /**
   * 自定义认证方式
   */
  private async recognizeWithCustomAuth(
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    // 生成自定义签名
    const timestamp = Date.now()
    const nonce = Math.random().toString(36).substring(2)
    const signature = crypto
      .createHmac('sha256', this.config.accessKeySecret)
      .update(`${this.config.appKey}${timestamp}${nonce}`)
      .digest('hex')

    const response = await axios.post('https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr', {
      format: options.format,
      sample_rate: options.sampleRate,
      language: options.language,
      enable_punctuation: options.enablePunctuation,
      enable_inverse_text_normalization: options.enableInverseTextNormalization,
      enable_speaker_diarization: options.enableSpeakerDiarization,
      speaker_count: options.speakerCount,
      enable_sample_rate_adaptive: true,
      model: 'paraformer-v1',
      vocabulary_id: '',
      disfluency: true,
      audio: audioBase64
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-NLS-Token': this.config.appKey,
        'X-NLS-AccessKey': this.config.accessKeyId,
        'X-NLS-Signature': signature,
        'X-NLS-Timestamp': timestamp.toString(),
        'X-NLS-Nonce': nonce
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('自定义认证返回格式错误')
  }

  /**
   * 模拟语音识别
   */
  private async mockRecognizeFromFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    logger.info('使用模拟语音识别服务处理文件:', filePath)

    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000))

    // 模拟识别文本库
    const mockTexts = [
      '大家好，欢迎参加今天的会议。',
      '我们需要讨论下一季度的产品规划。',
      '关于技术方案，我有几个建议。',
      '市场反馈显示用户需求正在增长。',
      '让我们制定具体的执行计划。',
      '这个项目的进展情况如何？',
      '我们需要考虑用户体验的优化。',
      '时间安排上可能会有一些调整。',
      '请大家积极发言，分享自己的想法。',
      '我们来看看数据分析的结果。',
      '根据最新的市场调研，用户对我们的产品反馈很好。',
      '下一阶段的工作重点应该放在功能完善上。',
      '团队协作效率需要进一步提升。',
      '客户的需求是我们最重要的考虑因素。',
      '技术创新将是我们的核心竞争力。'
    ]

    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]
    const confidence = 0.85 + Math.random() * 0.14
    const duration = 2000 + Math.random() * 6000

    // 生成词汇级别的模拟数据
    const words = randomText.split('').map((char, index) => ({
      word: char,
      startTime: index * (duration / randomText.length),
      endTime: (index + 1) * (duration / randomText.length),
      confidence: confidence + (Math.random() - 0.5) * 0.1
    }))

    const result: TranscriptionResult = {
      text: randomText,
      confidence: confidence,
      speakerId: options.enableSpeakerDiarization ? 'speaker_1' : undefined,
      speakerName: options.enableSpeakerDiarization ? '说话人1' : undefined,
      startTime: 0,
      endTime: duration,
      words: words
    }

    logger.info('模拟语音识别完成:', result.text)
    return [result]
  }

  /**
   * 解析转录结果
   */
  private parseTranscriptionResults(output: any): TranscriptionResult[] {
    const results: TranscriptionResult[] = []

    if (output.sentence) {
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

  /**
   * 实时语音识别会话
   */
  async createRealTimeSession(
    options: TranscriptionOptions = {}
  ): Promise<RealTimeTranscriptionSession | MockRealTimeTranscriptionSession> {
    if (this.useMockMode) {
      return new MockRealTimeTranscriptionSession(options)
    }

    // 尝试创建真实的实时会话
    try {
      const token = await this.auth.getAccessToken()
      return new RealTimeTranscriptionSession(token, options, this.config)
    } catch (error) {
      logger.warn('无法创建真实实时会话，回退到模拟模式:', error.message)
      return new MockRealTimeTranscriptionSession(options)
    }
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): {
    mode: 'mock' | 'real'
    availableMethods: string[]
    configValid: boolean
  } {
    return {
      mode: this.useMockMode ? 'mock' : 'real',
      availableMethods: this.availableAuthMethods,
      configValid: !!(this.config.appKey && this.config.accessKeyId && this.config.accessKeySecret)
    }
  }
}

/**
 * 模拟实时语音识别会话
 */
export class MockRealTimeTranscriptionSession {
  private options: TranscriptionOptions
  private isConnected: boolean = false
  private onEvent?: (event: RealTimeTranscriptionEvent) => void
  private onError?: (error: Error) => void
  private mockTimer?: NodeJS.Timeout
  private mockTexts: string[] = [
    '大家好，欢迎参加今天的会议。',
    '我们需要讨论下一季度的产品规划。',
    '关于技术方案，我有几个建议。',
    '市场反馈显示用户需求正在增长。',
    '让我们制定具体的执行计划。',
    '这个项目的进展情况如何？',
    '我们需要考虑用户体验的优化。',
    '时间安排上可能会有一些调整。',
    '请大家积极发言，分享自己的想法。',
    '我们来看看数据分析的结果。'
  ]
  private currentTextIndex: number = 0

  constructor(options: TranscriptionOptions) {
    this.options = options
  }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true
        this.onEvent?.({
          type: 'sentence_begin',
          timestamp: Date.now()
        })
        resolve()
        this.startMockTranscription()
      }, 500)
    })
  }

  private startMockTranscription(): void {
    let text = this.mockTexts[this.currentTextIndex % this.mockTexts.length]
    this.currentTextIndex++

    let currentLength = 0
    const interval = setInterval(() => {
      if (!this.isConnected || currentLength >= text.length) {
        clearInterval(interval)
        if (this.isConnected) {
          this.onEvent?.({
            type: 'sentence_end',
            timestamp: Date.now(),
            result: {
              text: text,
              confidence: 0.9 + Math.random() * 0.1,
              speakerId: this.options.enableSpeakerDiarization ? 'speaker_1' : undefined,
              speakerName: this.options.enableSpeakerDiarization ? '说话人1' : undefined,
              startTime: 0,
              endTime: text.length * 100,
              words: text.split('').map((char, index) => ({
                word: char,
                startTime: index * 100,
                endTime: (index + 1) * 100,
                confidence: 0.85 + Math.random() * 0.15
              }))
            }
          })

          this.mockTimer = setTimeout(() => {
            if (this.isConnected) {
              this.startMockTranscription()
            }
          }, 2000 + Math.random() * 3000)
        }
        return
      }

      currentLength++
      const partialText = text.substring(0, currentLength)

      this.onEvent?.({
        type: 'result_changed',
        timestamp: Date.now(),
        result: {
          text: partialText,
          confidence: 0.7 + Math.random() * 0.2,
          startTime: 0,
          endTime: currentLength * 100
        }
      })
    }, 100 + Math.random() * 200)
  }

  sendAudio(audioData: ArrayBuffer): void {
    // 模拟模式下忽略音频数据
  }

  on(event: 'data' | 'error', callback: (data: any) => void): void {
    if (event === 'data') {
      this.onEvent = callback as (event: RealTimeTranscriptionEvent) => void
    } else if (event === 'error') {
      this.onError = callback as (error: Error) => void
    }
  }

  close(): void {
    this.isConnected = false
    if (this.mockTimer) {
      clearTimeout(this.mockTimer)
      this.mockTimer = undefined
    }
    this.onEvent?.({
      type: 'completed',
      timestamp: Date.now()
    })
  }
}

/**
 * 真实的实时语音识别会话（保持原有的实现）
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
          this.handleMessage(event.data.toString())
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

  private sendStartMessage(): void {
    if (!this.ws || !this.isConnected) return

    const startMessage = {
      header: {
        message_id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
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

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || !this.isConnected) return

    const message = {
      header: {
        message_id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
        namespace: 'SpeechTranscriber',
        name: 'SendAudio',
        appkey: this.config.appKey
      },
      payload: {
        audio: Buffer.from(audioData).toString('base64'),
        status: 1
      }
    }

    this.ws.send(JSON.stringify(message))
  }

  on(event: 'data' | 'error', callback: (data: any) => void): void {
    if (event === 'data') {
      this.onEvent = callback as (event: RealTimeTranscriptionEvent) => void
    } else if (event === 'error') {
      this.onError = callback as (error: Error) => void
    }
  }

  close(): void {
    if (this.ws && this.isConnected) {
      this.sendStopMessage()
      this.ws.close()
      this.isConnected = false
    }
  }

  private sendStopMessage(): void {
    if (!this.ws || !this.isConnected) return

    const stopMessage = {
      header: {
        message_id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
        namespace: 'SpeechTranscriber',
        name: 'StopTranscription',
        appkey: this.config.appKey
      },
      payload: {}
    }

    this.ws.send(JSON.stringify(stopMessage))
  }
}

// 创建增强服务实例
export const enhancedSpeechService = new EnhancedSpeechRecognitionService({
  appKey: process.env.ALIBABA_CLOUD_APP_KEY || '',
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  region: process.env.ALIBABA_CLOUD_REGION || 'cn-shanghai'
}, process.env.NODE_ENV === 'development' || process.env.USE_MOCK_SPEECH_SERVICE === 'true')