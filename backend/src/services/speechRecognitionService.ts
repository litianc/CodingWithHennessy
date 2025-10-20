// @ts-nocheck
import axios from 'axios'
import crypto from 'crypto'
import WebSocket from 'ws'
import fs from 'fs/promises'
import { logger } from '@/utils/logger'
import { audioService } from './audioService'
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

export class AlibabaCloudSpeechService {
  private config: SpeechRecognitionConfig
  private auth: AlibabaCloudAuth
  public useMockMode: boolean = false

  constructor(config: SpeechRecognitionConfig, useMockMode: boolean = false) {
    this.config = config
    this.auth = new AlibabaCloudAuth({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      region: config.region
    })

    // 调试：记录初始化时的环境变量
    logger.info('SpeechService初始化:', {
      USE_MOCK_SPEECH_SERVICE: process.env.USE_MOCK_SPEECH_SERVICE,
      NODE_ENV: process.env.NODE_ENV,
      useMockMode_param: useMockMode,
      final_useMockMode: useMockMode || process.env.USE_MOCK_SPEECH_SERVICE === 'true'
    })

    this.useMockMode = useMockMode || process.env.USE_MOCK_SPEECH_SERVICE === 'true'
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    return await this.auth.getAccessToken()
  }

  /**
   * 模拟语音识别（用于开发测试）
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
      '我们来看看数据分析的结果。'
    ]

    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]
    const confidence = 0.85 + Math.random() * 0.14 // 85%-99%的置信度
    const duration = 2000 + Math.random() * 6000 // 2-8秒的音频时长

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
   * 文件语音识别（非实时）
   */
  async recognizeFromFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    // 如果启用模拟模式，直接返回模拟结果
    if (this.useMockMode) {
      return this.mockRecognizeFromFile(filePath, options)
    }

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
      const audioBuffer = await fs.readFile(filePath)
      const audioBase64 = audioBuffer.toString('base64')

      // 尝试不同的API调用方式
      const result = await this.tryDifferentAPIMethods(accessToken, defaultOptions, audioBase64)
      return result
    } catch (error) {
      logger.error('文件语音识别失败:', error)
      throw new Error('语音识别失败')
    }
  }

  /**
   * 尝试不同的API调用方式
   */
  private async tryDifferentAPIMethods(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    const methods = [
      () => this.callAPIMethodURLParam(accessToken, options, audioBase64), // 新方法：URL参数传递AppKey（正确方式）
      () => this.callAPIMethod1(accessToken, options, audioBase64),
      () => this.callAPIMethod2(accessToken, options, audioBase64),
      () => this.callAPIMethod3(accessToken, options, audioBase64),
      () => this.callAPIMethod4(accessToken, options, audioBase64)
    ]

    for (const method of methods) {
      try {
        const result = await method()
        if (result && result.length > 0) {
          logger.info('API调用成功')
          return result
        }
      } catch (error) {
        logger.warn('API方法失败，尝试下一种:', error.message)
      }
    }

    throw new Error('所有API调用方法都失败了')
  }

  /**
   * API方法: AppKey作为URL参数（正确方式！）
   */
  private async callAPIMethodURLParam(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    logger.info('尝试API方法: AppKey作为URL参数')

    const url = `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${this.config.appKey}`

    const response = await axios.post(url, {
      format: options.format,
      sample_rate: options.sampleRate,
      enable_intermediate_result: false,
      enable_punctuation_prediction: options.enablePunctuation,
      enable_inverse_text_normalization: options.enableInverseTextNormalization,
      audio: audioBase64
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-NLS-Token': accessToken
      },
      timeout: 30000
    })

    if (response.data && response.data.status === 20000000) {
      // 成功响应
      if (response.data.result) {
        return [{
          text: response.data.result,
          confidence: 1.0,
          startTime: 0,
          endTime: 0
        }]
      } else {
        // API调用成功但没有识别到文本
        logger.warn('API调用成功但没有识别到文本，可能音频文件没有语音内容')
        return []
      }
    }

    throw new Error(`API调用失败: ${response.data.message || '未知错误'}`)
  }

  /**
   * API方法1: 标准Token认证
   */
  private async callAPIMethod1(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    logger.info('尝试API方法1: 标准Token认证')

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
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-NLS-Token': accessToken
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('API方法1返回格式错误')
  }

  /**
   * API方法2: AppKey在请求体中
   */
  private async callAPIMethod2(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    logger.info('尝试API方法2: AppKey在请求体中')

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
        'X-NLS-Token': accessToken
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('API方法2返回格式错误')
  }

  /**
   * API方法3: 自定义认证头
   */
  private async callAPIMethod3(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    logger.info('尝试API方法3: 自定义认证头')

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
        'X-NLS-AccessKeySecret': this.config.accessKeySecret
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('API方法3返回格式错误')
  }

  /**
   * API方法4: 简化的Token认证
   */
  private async callAPIMethod4(
    accessToken: string,
    options: TranscriptionOptions,
    audioBase64: string
  ): Promise<TranscriptionResult[]> {
    logger.info('尝试API方法4: 简化的Token认证')

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
        'Authorization': accessToken,
        'X-NLS-Token': this.config.appKey
      },
      timeout: 30000
    })

    if (response.data && response.data.output) {
      return this.parseTranscriptionResults(response.data.output)
    }

    throw new Error('API方法4返回格式错误')
  }

  /**
   * 实时语音识别
   */
  async createRealTimeSession(
    options: TranscriptionOptions = {}
  ): Promise<RealTimeTranscriptionSession> {
    // 如果启用模拟模式，返回模拟会话
    if (this.useMockMode) {
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
      return new MockRealTimeTranscriptionSession(defaultOptions)
    }

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
    '让我们制定具体的执行计划。'
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
      }, 500) // 模拟连接延迟
    })
  }

  private startMockTranscription(): void {
    let text = this.mockTexts[this.currentTextIndex % this.mockTexts.length]
    this.currentTextIndex++

    // 模拟渐进式识别
    let currentLength = 0
    const interval = setInterval(() => {
      if (!this.isConnected || currentLength >= text.length) {
        clearInterval(interval)
        if (this.isConnected) {
          // 发送最终结果
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

          // 继续下一句
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

      // 发送中间结果
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

// 创建服务实例
export const speechService = new AlibabaCloudSpeechService({
  appKey: process.env.ALIBABA_CLOUD_APP_KEY || '',
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  region: process.env.ALIBABA_CLOUD_REGION || 'cn-shanghai'
}, process.env.USE_MOCK_SPEECH_SERVICE === 'true')