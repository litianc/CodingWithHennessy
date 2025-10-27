import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { logger } from '@/utils/logger'

export interface VoiceprintProfile {
  id: string
  userId: string
  name: string
  email: string
  voiceprintData: Float32Array | number[]
  sampleCount: number
  sampleRate: number
  createdAt: Date
  updatedAt: Date
  confidence: number
  metadata?: {
    deviceInfo?: string
    audioQuality?: string
    recordingEnvironment?: string
  }
}

export interface VoiceprintMatchResult {
  userId: string
  confidence: number
  similarity: number
  isMatch: boolean
  voiceprintId?: string
}

export class VoiceprintService {
  private voiceprints: Map<string, VoiceprintProfile> = new Map()
  private storagePath: string
  private minSampleLength: number = 8000 // 最小样本长度 (1秒@8kHz)
  private maxSamplesPerUser: number = 3 // 每用户最大声纹数量
  private similarityThreshold: number = 0.85 // 相似度阈值

  constructor() {
    this.storagePath = process.env.VOICEPRINT_STORAGE_PATH || path.join(process.cwd(), 'voiceprints')
    this.initStorage()
  }

  /**
   * 初始化存储
   */
  private async initStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
      await this.loadVoiceprints()
      logger.info('声纹存储初始化成功')
    } catch (error) {
      logger.error('声纹存储初始化失败:', error)
    }
  }

  /**
   * 加载声纹数据
   */
  private async loadVoiceprints(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.storagePath, file)
          const data = await fs.readFile(filePath, 'utf-8')
          const voiceprint: VoiceprintProfile = JSON.parse(data)
          this.voiceprints.set(voiceprint.id, voiceprint)
        } catch (error) {
          logger.error(`加载声纹文件失败 ${file}:`, error)
        }
      }

      logger.info(`加载了 ${this.voiceprints.size} 个声纹`)
    } catch (error) {
      logger.error('加载声纹数据失败:', error)
    }
  }

  /**
   * 保存声纹数据
   */
  private async saveVoiceprint(voiceprint: VoiceprintProfile): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, `${voiceprint.id}.json`)
      await fs.writeFile(filePath, JSON.stringify(voiceprint, null, 2))
      this.voiceprints.set(voiceprint.id, voiceprint)
      logger.info(`声纹保存成功: ${voiceprint.id}`)
    } catch (error) {
      logger.error('保存声纹失败:', error)
      throw error
    }
  }

  /**
   * 删除声纹
   */
  private async deleteVoiceprint(voiceprintId: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, `${voiceprintId}.json`)
      await fs.unlink(filePath)
      this.voiceprints.delete(voiceprintId)
      logger.info(`声纹删除成功: ${voiceprintId}`)
    } catch (error) {
      logger.error('删除声纹失败:', error)
      throw error
    }
  }

  /**
   * 提取音频特征 (简化版MFCC)
   */
  extractFeatures(audioBuffer: Float32Array): Float32Array {
    try {
      // 这里使用简化的特征提取方法
      // 在实际生产环境中，应该使用专业的语音特征提取库

      // 1. 预加重力
      const preEmphasis = 0.97
      const preEmphasized = new Float32Array(audioBuffer.length)
      preEmphasized[0] = audioBuffer[0]
      for (let i = 1; i < audioBuffer.length; i++) {
        preEmphasized[i] = audioBuffer[i] - preEmphasis * audioBuffer[i - 1]
      }

      // 2. 分帧
      const frameSize = 400
      const frameShift = 160
      const frames: Float32Array[] = []

      for (let i = 0; i < preEmphasized.length - frameSize; i += frameShift) {
        const frame = preEmphasized.slice(i, i + frameSize)
        frames.push(frame)
      }

      // 3. 计算每帧的能量
      const features: number[] = []
      for (const frame of frames) {
        let energy = 0
        for (const sample of frame) {
          energy += sample * sample
        }
        features.push(Math.sqrt(energy / frame.length))
      }

      // 4. 归一化
      const maxEnergy = Math.max(...features)
      if (maxEnergy > 0) {
        const normalizedFeatures = features.map(e => e / maxEnergy)
        return new Float32Array(normalizedFeatures)
      }

      return new Float32Array(features)
    } catch (error) {
      logger.error('特征提取失败:', error)
      return new Float32Array(0)
    }
  }

  /**
   * 创建声纹
   */
  async createVoiceprint(
    userId: string,
    name: string,
    email: string,
    audioBuffer: Float32Array,
    sampleRate: number = 16000,
    metadata?: VoiceprintProfile['metadata']
  ): Promise<VoiceprintProfile> {
    try {
      // 检查音频长度
      if (audioBuffer.length < this.minSampleLength) {
        throw new Error(`音频样本太短，至少需要 ${this.minSampleLength} 个样本`)
      }

      // 提取特征
      const voiceprintData = this.extractFeatures(audioBuffer)

      // 生成声纹ID
      const voiceprintId = crypto.randomBytes(16).toString('hex')

      // 检查用户是否已有声纹
      const userVoiceprints = Array.from(this.voiceprints.values())
        .filter(vp => vp.userId === userId)

      if (userVoiceprints.length >= this.maxSamplesPerUser) {
        // 删除最旧的声纹
        const oldestVoiceprint = userVoiceprints
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
        await this.deleteVoiceprint(oldestVoiceprint.id)
      }

      // 计算置信度
      const confidence = this.calculateConfidence(voiceprintData)

      const voiceprint: VoiceprintProfile = {
        id: voiceprintId,
        userId,
        name,
        email,
        voiceprintData: Array.from(voiceprintData),
        sampleCount: audioBuffer.length,
        sampleRate,
        createdAt: new Date(),
        updatedAt: new Date(),
        confidence,
        metadata: {
          deviceInfo: metadata?.deviceInfo || 'unknown',
          audioQuality: this.assessAudioQuality(audioBuffer, sampleRate),
          recordingEnvironment: metadata?.recordingEnvironment || 'unknown'
        }
      }

      await this.saveVoiceprint(voiceprint)
      logger.info(`创建声纹成功: ${voiceprintId} for user ${userId}`)

      return voiceprint
    } catch (error) {
      logger.error('创建声纹失败:', error)
      throw error
    }
  }

  /**
   * 评估音频质量
   */
  private assessAudioQuality(audioBuffer: Float32Array, sampleRate: number): string {
    try {
      // 检查音频质量指标
      let maxAmplitude = 0
      let dcOffset = 0

      for (const sample of audioBuffer) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(sample))
        dcOffset += sample
      }

      dcOffset /= audioBuffer.length

      // 归一化
      const normalizedBuffer = audioBuffer.map(s => s - dcOffset)
      const rms = Math.sqrt(normalizedBuffer.reduce((sum, s) => sum + s * s, 0) / normalizedBuffer.length)

      // 评估质量
      if (rms < 0.01) return 'very_low'
      if (rms < 0.05) return 'low'
      if (rms < 0.1) return 'medium'
      if (rms < 0.2) return 'good'
      return 'excellent'
    } catch (error) {
      logger.error('音频质量评估失败:', error)
      return 'unknown'
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(features: Float32Array): number {
    try {
      // 基于特征分布计算置信度
      const mean = features.reduce((sum, f) => sum + f, 0) / features.length
      const variance = features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / features.length
      const stdDev = Math.sqrt(variance)

      // 置信度基于标准差和特征分布
      const confidence = Math.min(1.0, stdDev * 2)
      return confidence
    } catch (error) {
      logger.error('置信度计算失败:', error)
      return 0.5
    }
  }

  /**
   * 匹配音纹
   */
  async matchVoiceprint(
    audioBuffer: Float32Array,
    sampleRate: number = 16000
  ): Promise<VoiceprintMatchResult[]> {
    try {
      if (this.voiceprints.size === 0) {
        return []
      }

      // 提取当前音频特征
      const currentFeatures = this.extractFeatures(audioBuffer)

      // 与所有声纹进行匹配
      const matches: VoiceprintMatchResult[] = []

      for (const [voiceprintId, voiceprint] of this.voiceprints) {
        const similarity = this.calculateSimilarity(
          currentFeatures,
          new Float32Array(voiceprint.voiceprintData)
        )

        const isMatch = similarity >= this.similarityThreshold
        const confidence = similarity

        if (isMatch || similarity > 0.5) { // 包含部分匹配
          matches.push({
            userId: voiceprint.userId,
            confidence,
            similarity,
            isMatch,
            voiceprintId
          })
        }
      }

      // 按相似度排序
      matches.sort((a, b) => b.similarity - a.similarity)

      return matches
    } catch (error) {
      logger.error('声纹匹配失败:', error)
      return []
    }
  }

  /**
   * 计算两个声纹的相似度
   */
  private calculateSimilarity(features1: Float32Array, features2: Float32Array): number {
    try {
      // 调整特征长度
      const minLength = Math.min(features1.length, features2.length)
      const f1 = features1.slice(0, minLength)
      const f2 = features2.slice(0, minLength)

      // 计算余弦相似度
      let dotProduct = 0
      let norm1 = 0
      let norm2 = 0

      for (let i = 0; i < minLength; i++) {
        dotProduct += f1[i] * f2[i]
        norm1 += f1[i] * f1[i]
        norm2 += f2[i] * f2[i]
      }

      norm1 = Math.sqrt(norm1)
      norm2 = Math.sqrt(norm2)

      if (norm1 === 0 || norm2 === 0) {
        return 0
      }

      return dotProduct / (norm1 * norm2)
    } catch (error) {
      logger.error('相似度计算失败:', error)
      return 0
    }
  }

  /**
   * 获取用户的声纹列表
   */
  async getUserVoiceprints(userId: string): Promise<VoiceprintProfile[]> {
    try {
      const userVoiceprints = Array.from(this.voiceprints.values())
        .filter(vp => vp.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return userVoiceprints
    } catch (error) {
      logger.error('获取用户声纹列表失败:', error)
      return []
    }
  }

  /**
   * 删除声纹
   */
  async deleteVoiceprintById(voiceprintId: string, userId: string): Promise<boolean> {
    try {
      const voiceprint = this.voiceprints.get(voiceprintId)
      if (!voiceprint || voiceprint.userId !== userId) {
        return false
      }

      await this.deleteVoiceprint(voiceprintId)
      return true
    } catch (error) {
      logger.error('删除声纹失败:', error)
      return false
    }
  }

  /**
   * 更新声纹
   */
  async updateVoiceprint(
    voiceprintId: string,
    userId: string,
    updates: Partial<Pick<VoiceprintProfile, 'id' | 'userId' | 'createdAt'>>
  ): Promise<VoiceprintProfile | null> {
    try {
      const voiceprint = this.voiceprints.get(voiceprintId)
      if (!voiceprint || voiceprint.userId !== userId) {
        return null
      }

      const updatedVoiceprint = {
        ...voiceprint,
        ...updates,
        updatedAt: new Date()
      }

      await this.saveVoiceprint(updatedVoiceprint)
      return updatedVoiceprint
    } catch (error) {
      logger.error('更新声纹失败:', error)
      return null
    }
  }

  /**
   * 声纹识别统计
   */
  async getVoiceprintStats(): Promise<{
    totalVoiceprints: number
    totalUsers: number
    averageConfidence: number
    qualityDistribution: Record<string, number>
  }> {
    try {
      const voiceprints = Array.from(this.voiceprints.values())
      const uniqueUsers = new Set(voiceprints.map(vp => vp.userId))

      const totalConfidence = voiceprints.reduce((sum, vp) => sum + vp.confidence, 0)
      const averageConfidence = voiceprints.length > 0 ? totalConfidence / voiceprints.length : 0

      const qualityDistribution = voiceprints.reduce((dist, vp) => {
        const quality = vp.metadata?.audioQuality || 'unknown'
        dist[quality] = (dist[quality] || 0) + 1
        return dist
      }, {} as Record<string, number>)

      return {
        totalVoiceprints: voiceprints.length,
        totalUsers: uniqueUsers.size,
        averageConfidence,
        qualityDistribution
      }
    } catch (error) {
      logger.error('获取声纹统计失败:', error)
      return {
        totalVoiceprints: 0,
        totalUsers: 0,
        averageConfidence: 0,
        qualityDistribution: {}
      }
    }
  }
}

/**
 * 声纹识别服务提供商枚举
 */
export enum VoiceprintServiceProvider {
  LOCAL = 'local',
  SPEAKER_3D = '3dspeaker'
}

/**
 * 声纹识别服务接口（统一接口）
 */
export interface IVoiceprintService {
  createVoiceprint(userId: string, name: string, email: string, audioBuffer: Float32Array, sampleRate?: number, metadata?: any): Promise<VoiceprintProfile>
  matchVoiceprint(audioBuffer: Float32Array, sampleRate?: number): Promise<VoiceprintMatchResult[]>
  getUserVoiceprints(userId: string): Promise<VoiceprintProfile[]>
  deleteVoiceprintById(voiceprintId: string, userId: string): Promise<boolean>
}

/**
 * 创建声纹识别服务实例（工厂模式）
 */
function createVoiceprintService(): IVoiceprintService {
  const provider = (process.env.VOICEPRINT_SERVICE_PROVIDER || '3dspeaker') as VoiceprintServiceProvider

  logger.info(`声纹识别服务提供商: ${provider}`)

  switch (provider) {
    case VoiceprintServiceProvider.SPEAKER_3D:
      // 使用 3D-Speaker 服务
      const { speakerRecognitionService } = require('./speakerRecognitionService')
      logger.info('使用 3D-Speaker 声纹识别服务')

      // 创建适配器，将 3D-Speaker API 适配到 VoiceprintService 接口
      return {
        async createVoiceprint(userId: string, name: string, email: string, audioBuffer: Float32Array, sampleRate = 16000) {
          // 保存 audioBuffer 到临时文件
          const tempPath = `/tmp/voiceprint_${Date.now()}.wav`
          const { saveAudio } = require('./audioService')
          await saveAudio(audioBuffer, tempPath, sampleRate)

          try {
            const profile = await speakerRecognitionService.registerSpeaker(userId, name, tempPath, email)
            return speakerRecognitionService.convertToVoiceprintProfile(profile) as VoiceprintProfile
          } finally {
            // 清理临时文件
            const fs = require('fs/promises')
            try { await fs.unlink(tempPath) } catch (e) { /* ignore */ }
          }
        },

        async matchVoiceprint(audioBuffer: Float32Array, sampleRate = 16000) {
          // 保存 audioBuffer 到临时文件
          const tempPath = `/tmp/recognize_${Date.now()}.wav`
          const { saveAudio } = require('./audioService')
          await saveAudio(audioBuffer, tempPath, sampleRate)

          try {
            const matches = await speakerRecognitionService.recognizeSpeaker(tempPath, 5)
            return speakerRecognitionService.convertToVoiceprintMatchResult(matches)
          } finally {
            // 清理临时文件
            const fs = require('fs/promises')
            try { await fs.unlink(tempPath) } catch (e) { /* ignore */ }
          }
        },

        async getUserVoiceprints(userId: string) {
          const speakers = await speakerRecognitionService.listSpeakers()
          return speakers
            .filter(s => s.user_id === userId)
            .map(s => speakerRecognitionService.convertToVoiceprintProfile(s)) as VoiceprintProfile[]
        },

        async deleteVoiceprintById(voiceprintId: string, userId: string) {
          return await speakerRecognitionService.deleteSpeaker(voiceprintId)
        }
      } as IVoiceprintService

    case VoiceprintServiceProvider.LOCAL:
      // 使用本地实现
      const localService = new VoiceprintService()
      logger.info('使用本地声纹识别服务')
      return localService as IVoiceprintService

    default:
      logger.warn(`未知的声纹识别服务提供商: ${provider}，使用 3D-Speaker 作为默认`)
      const { speakerRecognitionService: defaultService } = require('./speakerRecognitionService')
      logger.info('使用 3D-Speaker 声纹识别服务（默认）')

      // 返回适配器（同上）
      return {
        async createVoiceprint(userId: string, name: string, email: string, audioBuffer: Float32Array, sampleRate = 16000) {
          const tempPath = `/tmp/voiceprint_${Date.now()}.wav`
          const { saveAudio } = require('./audioService')
          await saveAudio(audioBuffer, tempPath, sampleRate)
          try {
            const profile = await defaultService.registerSpeaker(userId, name, tempPath, email)
            return defaultService.convertToVoiceprintProfile(profile) as VoiceprintProfile
          } finally {
            const fs = require('fs/promises')
            try { await fs.unlink(tempPath) } catch (e) { /* ignore */ }
          }
        },
        async matchVoiceprint(audioBuffer: Float32Array, sampleRate = 16000) {
          const tempPath = `/tmp/recognize_${Date.now()}.wav`
          const { saveAudio } = require('./audioService')
          await saveAudio(audioBuffer, tempPath, sampleRate)
          try {
            const matches = await defaultService.recognizeSpeaker(tempPath, 5)
            return defaultService.convertToVoiceprintMatchResult(matches)
          } finally {
            const fs = require('fs/promises')
            try { await fs.unlink(tempPath) } catch (e) { /* ignore */ }
          }
        },
        async getUserVoiceprints(userId: string) {
          const speakers = await defaultService.listSpeakers()
          return speakers
            .filter(s => s.user_id === userId)
            .map(s => defaultService.convertToVoiceprintProfile(s)) as VoiceprintProfile[]
        },
        async deleteVoiceprintById(voiceprintId: string, userId: string) {
          return await defaultService.deleteSpeaker(voiceprintId)
        }
      } as IVoiceprintService
  }
}

// 导出单例实例
export const voiceprintService = createVoiceprintService()