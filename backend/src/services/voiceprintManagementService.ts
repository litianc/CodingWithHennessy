/**
 * 声纹库管理服务
 *
 * 基于MongoDB存储和3D-Speaker服务的声纹管理
 */
import { Voiceprint, IVoiceprint, IAudioSample, IEmbedding } from '@/models/Voiceprint'
import { speakerRecognitionService } from './speakerRecognitionService'
import { logger } from '@/utils/logger'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface RegisterVoiceprintRequest {
  name: string
  department?: string
  position?: string
  email?: string
  phone?: string
  audioSamples: Array<{
    filename: string
    path: string
    duration: number
    sampleRate?: number
  }>
  ownerId: string
  isPublic?: boolean
  allowedUsers?: string[]
}

export interface VoiceprintListQuery {
  ownerId?: string
  name?: string
  department?: string
  page?: number
  pageSize?: number
  includePublic?: boolean
}

export interface VoiceprintMatchResult {
  voiceprintId: string
  name: string
  department?: string
  similarity: number
  confidence: number
  isMatch: boolean
}

export interface AddSamplesRequest {
  voiceprintId: string
  samples: Array<{
    filename: string
    path: string
    duration: number
    sampleRate?: number
  }>
  userId: string
}

export class VoiceprintManagementService {
  /**
   * 注册声纹
   *
   * 1. 验证音频样本数量（至少3个）
   * 2. 调用3D-Speaker提取声纹特征
   * 3. 存储到MongoDB
   */
  async register(request: RegisterVoiceprintRequest): Promise<IVoiceprint> {
    try {
      logger.info(`注册声纹: ${request.name}`, { ownerId: request.ownerId })

      // 验证样本数量
      if (!request.audioSamples || request.audioSamples.length < 3) {
        throw new Error('至少需要3个音频样本来注册声纹')
      }

      // 使用第一个样本向3D-Speaker注册
      const firstSample = request.audioSamples[0]
      const speakerProfile = await speakerRecognitionService.registerSpeaker(
        request.ownerId,
        request.name,
        firstSample.path,
        request.email
      )

      // 从3D-Speaker获取embedding（这里需要调用extract API）
      // 由于3D-Speaker注册时已经提取了embedding，我们需要从服务获取
      // 暂时创建一个占位embedding，实际应该从3D-Speaker获取
      const embedding: IEmbedding = {
        vector: [], // 需要从3D-Speaker API获取
        dim: 192,
        modelVersion: '3D-Speaker-v1'
      }

      // 准备音频样本信息
      const samples: IAudioSample[] = request.audioSamples.map(sample => ({
        filename: sample.filename,
        path: sample.path,
        duration: sample.duration,
        sampleRate: sample.sampleRate || 16000,
        createdAt: new Date()
      }))

      // 创建声纹文档
      const voiceprint = new Voiceprint({
        speakerId: speakerProfile.speaker_id, // 保存3D-Speaker的speaker_id
        name: request.name,
        department: request.department,
        position: request.position,
        email: request.email,
        phone: request.phone,
        embedding,
        samples,
        sampleCount: samples.length,
        stats: {
          totalMatches: 0,
          avgConfidence: 0
        },
        ownerId: request.ownerId,
        isPublic: request.isPublic || false,
        allowedUsers: request.allowedUsers || []
      })

      logger.info('准备保存声纹到MongoDB', {
        speakerId: speakerProfile.speaker_id,
        name: request.name,
        ownerId: request.ownerId
      })

      try {
        const savedVoiceprint = await voiceprint.save()
        logger.info(`✅ 声纹已成功保存到MongoDB: ${savedVoiceprint._id}`, {
          _id: savedVoiceprint._id.toString(),
          name: savedVoiceprint.name,
          speakerId: savedVoiceprint.speakerId,
          ownerId: savedVoiceprint.ownerId.toString(),
          sampleCount: savedVoiceprint.sampleCount,
          collection: 'voiceprints'
        })

        // 立即验证保存是否成功
        const verification = await Voiceprint.findById(savedVoiceprint._id)
        if (verification) {
          logger.info('✅ MongoDB保存验证成功', {
            _id: verification._id.toString(),
            name: verification.name
          })
        } else {
          logger.error('❌ MongoDB保存验证失败：无法找回刚保存的记录', {
            _id: savedVoiceprint._id.toString()
          })
        }
      } catch (saveError: any) {
        logger.error('❌ 保存声纹到MongoDB失败:', {
          error: saveError.message,
          stack: saveError.stack,
          name: request.name,
          ownerId: request.ownerId
        })
        throw saveError
      }

      logger.info(`声纹注册成功: ${voiceprint._id}`, {
        name: request.name,
        sampleCount: samples.length
      })

      return voiceprint
    } catch (error: any) {
      logger.error('声纹注册失败:', error)
      throw new Error(`声纹注册失败: ${error.message}`)
    }
  }

  /**
   * 获取声纹列表
   *
   * 支持分页和筛选，考虑访问权限
   */
  async list(query: VoiceprintListQuery): Promise<{
    items: IVoiceprint[]
    total: number
    page: number
    pageSize: number
  }> {
    try {
      const page = query.page || 1
      const pageSize = query.pageSize || 20
      const skip = (page - 1) * pageSize

      // 构建查询条件
      const conditions: any = { deletedAt: null }

      if (query.name) {
        conditions.name = { $regex: query.name, $options: 'i' }
      }

      if (query.department) {
        conditions.department = query.department
      }

      // 访问权限控制
      if (query.ownerId) {
        if (query.includePublic) {
          conditions.$or = [
            { ownerId: query.ownerId },
            { isPublic: true },
            { allowedUsers: query.ownerId }
          ]
        } else {
          conditions.ownerId = query.ownerId
        }
      }

      const [items, total] = await Promise.all([
        Voiceprint.find(conditions)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .populate('ownerId', 'name email'),
        Voiceprint.countDocuments(conditions)
      ])

      logger.info(`查询声纹列表成功: ${items.length}/${total}`)

      return { items, total, page, pageSize }
    } catch (error: any) {
      logger.error('查询声纹列表失败:', error)
      throw new Error(`查询声纹列表失败: ${error.message}`)
    }
  }

  /**
   * 获取声纹详情
   */
  async getById(voiceprintId: string, userId: string): Promise<IVoiceprint | null> {
    try {
      const voiceprint = await Voiceprint.findOne({
        _id: voiceprintId,
        deletedAt: null
      }).populate('ownerId', 'name email')

      if (!voiceprint) {
        return null
      }

      // 检查访问权限
      if (!this.hasAccess(voiceprint, userId)) {
        throw new Error('无权访问该声纹')
      }

      return voiceprint
    } catch (error: any) {
      logger.error('获取声纹详情失败:', error)
      throw new Error(`获取声纹详情失败: ${error.message}`)
    }
  }

  /**
   * 更新声纹信息
   */
  async update(
    voiceprintId: string,
    userId: string,
    updates: Partial<Pick<IVoiceprint, 'name' | 'department' | 'position' | 'email' | 'phone' | 'isPublic' | 'allowedUsers'>>
  ): Promise<IVoiceprint | null> {
    try {
      const voiceprint = await Voiceprint.findOne({
        _id: voiceprintId,
        deletedAt: null
      })

      if (!voiceprint) {
        return null
      }

      // 只有所有者可以更新
      if (voiceprint.ownerId.toString() !== userId) {
        throw new Error('只有所有者可以更新声纹信息')
      }

      // 更新字段
      Object.assign(voiceprint, updates)
      await voiceprint.save()

      logger.info(`声纹更新成功: ${voiceprintId}`)

      return voiceprint
    } catch (error: any) {
      logger.error('更新声纹失败:', error)
      throw new Error(`更新声纹失败: ${error.message}`)
    }
  }

  /**
   * 删除声纹（软删除）
   */
  async delete(voiceprintId: string, userId: string): Promise<boolean> {
    try {
      const voiceprint = await Voiceprint.findOne({
        _id: voiceprintId,
        deletedAt: null
      })

      if (!voiceprint) {
        return false
      }

      // 只有所有者可以删除
      if (voiceprint.ownerId.toString() !== userId) {
        throw new Error('只有所有者可以删除声纹')
      }

      // 软删除
      voiceprint.softDelete()
      await voiceprint.save()

      // 同时从3D-Speaker服务删除
      try {
        await speakerRecognitionService.deleteSpeaker(voiceprintId)
      } catch (error) {
        logger.warn(`从3D-Speaker删除声纹失败: ${voiceprintId}`, error)
      }

      logger.info(`声纹删除成功: ${voiceprintId}`)

      return true
    } catch (error: any) {
      logger.error('删除声纹失败:', error)
      throw new Error(`删除声纹失败: ${error.message}`)
    }
  }

  /**
   * 添加音频样本
   */
  async addSamples(request: AddSamplesRequest): Promise<IVoiceprint | null> {
    try {
      const voiceprint = await Voiceprint.findOne({
        _id: request.voiceprintId,
        deletedAt: null
      })

      if (!voiceprint) {
        return null
      }

      // 只有所有者可以添加样本
      if (voiceprint.ownerId.toString() !== request.userId) {
        throw new Error('只有所有者可以添加音频样本')
      }

      // 添加样本
      for (const sample of request.samples) {
        voiceprint.addSample({
          filename: sample.filename,
          path: sample.path,
          duration: sample.duration,
          sampleRate: sample.sampleRate || 16000
        })
      }

      await voiceprint.save()

      logger.info(`添加音频样本成功: ${request.voiceprintId}`, {
        addedCount: request.samples.length,
        totalCount: voiceprint.sampleCount
      })

      return voiceprint
    } catch (error: any) {
      logger.error('添加音频样本失败:', error)
      throw new Error(`添加音频样本失败: ${error.message}`)
    }
  }

  /**
   * 识别声纹
   *
   * 调用3D-Speaker识别后，从MongoDB获取完整信息
   */
  async recognize(audioPath: string, topK: number = 5): Promise<VoiceprintMatchResult[]> {
    try {
      logger.info(`识别声纹: ${audioPath}`)

      // 调用3D-Speaker识别
      const matches = await speakerRecognitionService.recognizeSpeaker(audioPath, topK)

      // 从MongoDB获取声纹详情
      const results: VoiceprintMatchResult[] = []

      for (const match of matches) {
        const voiceprint = await Voiceprint.findOne({
          speakerId: match.speaker_id, // 使用speakerId字段查询
          deletedAt: null
        })

        if (voiceprint) {
          // 更新匹配统计
          voiceprint.updateMatchStats(match.confidence)
          await voiceprint.save()

          results.push({
            voiceprintId: voiceprint._id.toString(),
            name: voiceprint.name,
            department: voiceprint.department,
            similarity: match.similarity,
            confidence: match.confidence,
            isMatch: match.is_match
          })
        }
      }

      logger.info(`声纹识别完成，找到 ${results.length} 个匹配`)

      return results
    } catch (error: any) {
      logger.error('声纹识别失败:', error)
      throw new Error(`声纹识别失败: ${error.message}`)
    }
  }

  /**
   * 获取声纹统计
   */
  async getStats(userId?: string): Promise<{
    totalVoiceprints: number
    totalUsers: number
    publicVoiceprints: number
    recentMatches: number
  }> {
    try {
      const conditions: any = { deletedAt: null }

      if (userId) {
        conditions.$or = [
          { ownerId: userId },
          { isPublic: true },
          { allowedUsers: userId }
        ]
      }

      const [total, publicCount, recentMatches] = await Promise.all([
        Voiceprint.countDocuments(conditions),
        Voiceprint.countDocuments({ ...conditions, isPublic: true }),
        Voiceprint.countDocuments({
          ...conditions,
          'stats.lastMatchedAt': {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
          }
        })
      ])

      const uniqueOwners = await Voiceprint.distinct('ownerId', conditions)

      return {
        totalVoiceprints: total,
        totalUsers: uniqueOwners.length,
        publicVoiceprints: publicCount,
        recentMatches
      }
    } catch (error: any) {
      logger.error('获取声纹统计失败:', error)
      throw new Error(`获取声纹统计失败: ${error.message}`)
    }
  }

  /**
   * 检查访问权限
   */
  private hasAccess(voiceprint: IVoiceprint, userId: string): boolean {
    // 所有者可以访问
    if (voiceprint.ownerId.toString() === userId) {
      return true
    }

    // 公开声纹可以访问
    if (voiceprint.isPublic) {
      return true
    }

    // 在允许列表中可以访问
    if (voiceprint.allowedUsers.some(id => id.toString() === userId)) {
      return true
    }

    return false
  }
}

// 导出单例实例
export const voiceprintManagementService = new VoiceprintManagementService()
