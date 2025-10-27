// @ts-nocheck
import { Response } from 'express'
import { validationResult } from 'express-validator'
import { voiceprintManagementService } from '@/services/voiceprintManagementService'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { logger } from '@/utils/logger'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'

// 文件上传配置
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'voiceprints', 'temp')
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /wav|mp3|m4a|flac/
    const ext = path.extname(file.originalname).toLowerCase().substring(1)
    if (allowedTypes.test(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 WAV, MP3, M4A, FLAC 格式的音频文件'))
    }
  }
})

/**
 * POST /api/voiceprint/register
 * 注册声纹
 */
export const registerVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  try {
    // 调试：打印 req.body 的内容
    logger.info('req.body内容:', req.body)
    logger.info('req.files数量:', Array.isArray(req.files) ? req.files.length : 0)

    const { name, department, position, email, phone, userId, isPublic, allowedUsers } = req.body
    const currentUserId = req.user!._id

    // 使用前端传来的 userId，如果没有则使用当前登录用户ID
    const ownerId = userId || currentUserId

    logger.info('userId from body:', userId)
    logger.info('currentUserId:', currentUserId)
    logger.info('final ownerId:', ownerId)

    // 检查音频文件
    if (!req.files || !Array.isArray(req.files) || req.files.length < 3) {
      res.status(400).json({
        success: false,
        message: '至少需要上传3个音频样本',
        error: {
          code: 'INSUFFICIENT_SAMPLES',
          message: '至少需要3个音频样本'
        }
      })
      return
    }

    // 准备音频样本信息
    const audioSamples = await Promise.all(
      req.files.map(async (file: Express.Multer.File) => {
        // TODO: 使用audioService获取音频时长
        const duration = 5.0 // 占位值

        return {
          filename: file.originalname,
          path: file.path,
          duration,
          sampleRate: 16000
        }
      })
    )

    // 注册声纹
    const voiceprint = await voiceprintManagementService.register({
      name,
      department,
      position,
      email,
      phone,
      audioSamples,
      ownerId: ownerId,
      isPublic: isPublic === 'true' || isPublic === true,
      allowedUsers: allowedUsers ? JSON.parse(allowedUsers) : []
    })

    logger.info(`声纹注册成功: ${voiceprint._id}`, {
      name,
      ownerId,
      providedUserId: userId,
      sampleCount: audioSamples.length
    })

    res.status(201).json({
      success: true,
      data: {
        id: voiceprint._id,
        name: voiceprint.name,
        department: voiceprint.department,
        position: voiceprint.position,
        samplesCount: voiceprint.sampleCount,
        createdAt: voiceprint.createdAt
      }
    })
  } catch (error: any) {
    logger.error('声纹注册失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message || '声纹注册失败'
      }
    })
  }
})

/**
 * GET /api/voiceprint/list
 * 获取声纹列表
 */
export const getVoiceprintList = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id
    const {
      page = 1,
      pageSize = 20,
      name,
      department,
      includePublic = 'true'
    } = req.query

    const result = await voiceprintManagementService.list({
      ownerId: userId,
      name: name as string,
      department: department as string,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      includePublic: includePublic === 'true'
    })

    res.json({
      success: true,
      data: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        items: result.items.map(vp => ({
          id: vp._id,
          name: vp.name,
          department: vp.department,
          position: vp.position,
          samplesCount: vp.sampleCount,
          createdAt: vp.createdAt,
          updatedAt: vp.updatedAt,
          lastMatchedAt: vp.stats?.lastMatchedAt
        }))
      }
    })
  } catch (error: any) {
    logger.error('获取声纹列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取声纹列表失败'
    })
  }
})

/**
 * GET /api/voiceprint/:id
 * 获取声纹详情
 */
export const getVoiceprintDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!._id

    const voiceprint = await voiceprintManagementService.getById(id, userId)

    if (!voiceprint) {
      res.status(404).json({
        success: false,
        message: '声纹不存在'
      })
      return
    }

    res.json({
      success: true,
      data: {
        id: voiceprint._id,
        name: voiceprint.name,
        department: voiceprint.department,
        position: voiceprint.position,
        samplesCount: voiceprint.sampleCount,
        samples: voiceprint.samples.map(s => ({
          filename: s.filename,
          duration: s.duration,
          createdAt: s.createdAt
        })),
        statistics: {
          totalMatches: voiceprint.stats.totalMatches,
          avgConfidence: voiceprint.stats.avgConfidence,
          lastMatchedAt: voiceprint.stats.lastMatchedAt
        },
        createdAt: voiceprint.createdAt,
        updatedAt: voiceprint.updatedAt
      }
    })
  } catch (error: any) {
    logger.error('获取声纹详情失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取声纹详情失败'
    })
  }
})

/**
 * PUT /api/voiceprint/:id
 * 更新声纹信息
 */
export const updateVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  try {
    const { id } = req.params
    const userId = req.user!._id
    const { name, department, position, email, phone, isPublic, allowedUsers } = req.body

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (department !== undefined) updates.department = department
    if (position !== undefined) updates.position = position
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (isPublic !== undefined) updates.isPublic = isPublic
    if (allowedUsers !== undefined) updates.allowedUsers = allowedUsers

    const voiceprint = await voiceprintManagementService.update(id, userId, updates)

    if (!voiceprint) {
      res.status(404).json({
        success: false,
        message: '声纹不存在或无权更新'
      })
      return
    }

    logger.info(`声纹更新成功: ${id}`, { userId })

    res.json({
      success: true,
      message: '声纹更新成功',
      data: {
        id: voiceprint._id,
        name: voiceprint.name,
        department: voiceprint.department,
        position: voiceprint.position,
        updatedAt: voiceprint.updatedAt
      }
    })
  } catch (error: any) {
    logger.error('更新声纹失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '更新声纹失败'
    })
  }
})

/**
 * DELETE /api/voiceprint/:id
 * 删除声纹
 */
export const deleteVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!._id

    const success = await voiceprintManagementService.delete(id, userId)

    if (!success) {
      res.status(404).json({
        success: false,
        message: '声纹不存在或无权删除'
      })
      return
    }

    logger.info(`声纹删除成功: ${id}`, { userId })

    res.json({
      success: true,
      message: '声纹已删除'
    })
  } catch (error: any) {
    logger.error('删除声纹失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '删除声纹失败'
    })
  }
})

/**
 * POST /api/voiceprint/:id/samples
 * 添加音频样本
 */
export const addAudioSamples = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = req.user!._id

    // 检查音频文件
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: '请上传至少一个音频样本'
      })
      return
    }

    // 准备音频样本信息
    const samples = await Promise.all(
      req.files.map(async (file: Express.Multer.File) => {
        // TODO: 使用audioService获取音频时长
        const duration = 5.0 // 占位值

        return {
          filename: file.originalname,
          path: file.path,
          duration,
          sampleRate: 16000
        }
      })
    )

    const voiceprint = await voiceprintManagementService.addSamples({
      voiceprintId: id,
      samples,
      userId
    })

    if (!voiceprint) {
      res.status(404).json({
        success: false,
        message: '声纹不存在或无权添加样本'
      })
      return
    }

    logger.info(`添加音频样本成功: ${id}`, {
      userId,
      addedCount: samples.length
    })

    res.json({
      success: true,
      message: '音频样本添加成功',
      data: {
        addedCount: samples.length,
        totalCount: voiceprint.sampleCount
      }
    })
  } catch (error: any) {
    logger.error('添加音频样本失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '添加音频样本失败'
    })
  }
})

/**
 * GET /api/voiceprint/stats
 * 获取声纹统计信息
 */
export const getVoiceprintStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id

    const stats = await voiceprintManagementService.getStats(userId)

    res.json({
      success: true,
      data: { stats }
    })
  } catch (error: any) {
    logger.error('获取声纹统计失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取声纹统计失败'
    })
  }
})

// 导出文件上传中间件
export const uploadSingle = upload.single('audio')
export const uploadMultiple = upload.array('audioSamples', 10) // 最多10个样本
