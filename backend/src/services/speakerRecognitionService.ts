/**
 * 3D-Speaker 声纹识别服务客户端
 *
 * 提供声纹注册、识别、说话人分割等功能
 */
import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs/promises'
import { logger } from '@/utils/logger'
import type { VoiceprintProfile, VoiceprintMatchResult } from './voiceprintService'

export interface SpeakerServiceConfig {
  serviceUrl: string
  timeout: number
  similarityThreshold: number
}

export interface SpeakerProfile {
  speaker_id: string
  name: string
  user_id?: string
  email?: string
  created_at: string
  sample_count: number
}

export interface SpeakerMatchResult {
  speaker_id: string
  name: string
  user_id?: string
  email?: string
  similarity: number
  confidence: number
  is_match: boolean
}

export interface DiarizationSegment {
  start_time: number
  end_time: number
  speaker_id: string
  confidence: number
}

export class SpeakerRecognitionService {
  private config: SpeakerServiceConfig
  private httpClient: AxiosInstance

  constructor(config: SpeakerServiceConfig) {
    this.config = config

    // 创建 HTTP 客户端
    this.httpClient = axios.create({
      baseURL: config.serviceUrl,
      timeout: config.timeout,
      headers: {
        'Accept': 'application/json'
      }
    })

    logger.info('3D-Speaker 服务初始化完成', {
      serviceUrl: config.serviceUrl,
      similarityThreshold: config.similarityThreshold
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
      logger.error('3D-Speaker 健康检查失败:', error)
      return false
    }
  }

  /**
   * 注册声纹
   */
  async registerSpeaker(
    userId: string,
    name: string,
    audioPath: string,
    email?: string
  ): Promise<SpeakerProfile> {
    try {
      logger.info(`注册声纹: ${name} (${userId})`)

      // 准备表单数据
      const formData = new FormData()
      formData.append('name', name)
      formData.append('user_id', userId)

      if (email) {
        formData.append('email', email)
      }

      // 读取音频文件
      const audioBuffer = await fs.readFile(audioPath)
      formData.append('audio_files', audioBuffer, {
        filename: audioPath.split('/').pop() || 'audio.wav',
        contentType: 'audio/wav'
      })

      // 发送请求
      const response = await this.httpClient.post('/api/speaker/register', formData, {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      if (response.data?.success && response.data?.data) {
        logger.info(`声纹注册成功: ${response.data.data.speaker_id}`)
        return response.data.data
      } else {
        throw new Error(`声纹注册失败: ${response.data?.message || '未知错误'}`)
      }

    } catch (error: any) {
      logger.error('声纹注册失败:', error)
      throw new Error(`声纹注册失败: ${error.message}`)
    }
  }

  /**
   * 识别说话人
   */
  async recognizeSpeaker(
    audioPath: string,
    topK: number = 5
  ): Promise<SpeakerMatchResult[]> {
    try {
      logger.info(`识别说话人: ${audioPath}`)

      // 准备表单数据
      const formData = new FormData()
      formData.append('top_k', String(topK))

      // 读取音频文件
      const audioBuffer = await fs.readFile(audioPath)
      formData.append('audio', audioBuffer, {
        filename: audioPath.split('/').pop() || 'audio.wav',
        contentType: 'audio/wav'
      })

      // 发送请求
      const response = await this.httpClient.post('/api/speaker/recognize', formData, {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      if (response.data?.success && response.data?.data?.matches) {
        const matches = response.data.data.matches

        logger.info(`说话人识别完成，找到 ${matches.length} 个匹配`)

        return matches
      } else {
        throw new Error(`说话人识别失败: ${response.data?.message || '未知错误'}`)
      }

    } catch (error: any) {
      logger.error('说话人识别失败:', error)
      throw new Error(`说话人识别失败: ${error.message}`)
    }
  }

  /**
   * 说话人分割
   */
  async diarization(
    audioPath: string,
    numSpeakers?: number
  ): Promise<DiarizationSegment[]> {
    try {
      logger.info(`说话人分割: ${audioPath}`)

      // 准备表单数据
      const formData = new FormData()

      if (numSpeakers !== undefined) {
        formData.append('num_speakers', String(numSpeakers))
      }

      // 读取音频文件
      const audioBuffer = await fs.readFile(audioPath)
      formData.append('audio', audioBuffer, {
        filename: audioPath.split('/').pop() || 'audio.wav',
        contentType: 'audio/wav'
      })

      // 发送请求
      const response = await this.httpClient.post('/api/speaker/diarization', formData, {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      if (response.data?.success && response.data?.data?.segments) {
        const segments = response.data.data.segments

        logger.info(`说话人分割完成，检测到 ${segments.length} 个片段`)

        return segments
      } else {
        throw new Error(`说话人分割失败: ${response.data?.message || '未知错误'}`)
      }

    } catch (error: any) {
      logger.error('说话人分割失败:', error)
      throw new Error(`说话人分割失败: ${error.message}`)
    }
  }

  /**
   * 获取说话人列表
   */
  async listSpeakers(): Promise<SpeakerProfile[]> {
    try {
      const response = await this.httpClient.get('/api/speaker/list')

      if (response.data?.success && response.data?.data?.speakers) {
        return response.data.data.speakers
      } else {
        throw new Error(`获取说话人列表失败: ${response.data?.message || '未知错误'}`)
      }

    } catch (error: any) {
      logger.error('获取说话人列表失败:', error)
      throw new Error(`获取说话人列表失败: ${error.message}`)
    }
  }

  /**
   * 删除声纹
   */
  async deleteSpeaker(speakerId: string): Promise<boolean> {
    try {
      logger.info(`删除声纹: ${speakerId}`)

      const response = await this.httpClient.delete(`/api/speaker/${speakerId}`)

      if (response.data?.success) {
        logger.info(`声纹删除成功: ${speakerId}`)
        return true
      } else {
        return false
      }

    } catch (error: any) {
      logger.error('删除声纹失败:', error)
      return false
    }
  }

  /**
   * 将 3D-Speaker 匹配结果转换为 VoiceprintMatchResult 格式
   * (兼容现有接口)
   */
  convertToVoiceprintMatchResult(matches: SpeakerMatchResult[]): VoiceprintMatchResult[] {
    return matches.map(match => ({
      userId: match.user_id || match.speaker_id,
      confidence: match.confidence,
      similarity: match.similarity,
      isMatch: match.is_match,
      voiceprintId: match.speaker_id
    }))
  }

  /**
   * 将 SpeakerProfile 转换为 VoiceprintProfile 格式
   * (兼容现有接口)
   */
  convertToVoiceprintProfile(profile: SpeakerProfile): Partial<VoiceprintProfile> {
    return {
      id: profile.speaker_id,
      userId: profile.user_id || '',
      name: profile.name,
      email: profile.email || '',
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.created_at),
      sampleCount: profile.sample_count,
      confidence: 0.9
    }
  }
}

// 创建服务实例
export const speakerRecognitionService = new SpeakerRecognitionService({
  serviceUrl: process.env.SPEAKER_SERVICE_URL || 'http://localhost:5002',
  timeout: parseInt(process.env.SPEAKER_SERVICE_TIMEOUT || '15000'),
  similarityThreshold: parseFloat(process.env.SPEAKER_SIMILARITY_THRESHOLD || '0.75')
})
