// @ts-nocheck
import { Response } from 'express'
import { validationResult } from 'express-validator'
import { voiceprintService } from '@/services/voiceprintService'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { logger } from '@/utils/logger'

// 获取用户声纹列表
export const getUserVoiceprints = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id

  const voiceprints = await voiceprintService.getUserVoiceprints(userId)

  res.json({
    success: true,
    data: { voiceprints }
  })
})

// 创建声纹
export const createVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { name, email, metadata } = req.body
  const userId = req.user!._id

  // 检查是否有音频文件上传
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: '请上传音频文件'
    })
    return
  }

  try {
    // 将音频缓冲区转换为Float32Array
    const audioBuffer = req.file.buffer
    const float32Array = new Float32Array(audioBuffer.length / 2)

    // 假设16位音频数据
    const dataView = new DataView(audioBuffer.buffer)
    for (let i = 0; i < float32Array.length; i++) {
      const sample = dataView.getInt16(i * 2, true) // true为小端序
      float32Array[i] = sample / 32768.0 // 归一化到[-1, 1]范围
    }

    // 创建声纹
    const voiceprint = await voiceprintService.createVoiceprint(
      userId,
      name,
      email,
      float32Array,
      16000, // 默认采样率16kHz
      metadata
    )

    logger.info(`声纹创建成功: ${voiceprint.id} for user ${userId}`)

    res.status(201).json({
      success: true,
      message: '声纹创建成功',
      data: { voiceprint }
    })
  } catch (error) {
    logger.error('声纹创建失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '声纹创建失败'
    })
  }
})

// 匹配音纹
export const matchVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 检查是否有音频文件上传
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: '请上传音频文件'
    })
    return
  }

  try {
    // 将音频缓冲区转换为Float32Array
    const audioBuffer = req.file.buffer
    const float32Array = new Float32Array(audioBuffer.length / 2)

    // 假设16位音频数据
    const dataView = new DataView(audioBuffer.buffer)
    for (let i = 0; i < float32Array.length; i++) {
      const sample = dataView.getInt16(i * 2, true) // true为小端序
      float32Array[i] = sample / 32768.0 // 归一化到[-1, 1]范围
    }

    // 进行声纹匹配
    const matches = await voiceprintService.matchVoiceprint(float32Array, 16000)

    res.json({
      success: true,
      data: { matches }
    })
  } catch (error) {
    logger.error('声纹匹配失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '声纹匹配失败'
    })
  }
})

// 删除声纹
export const deleteVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const success = await voiceprintService.deleteVoiceprintById(id, userId)

  if (!success) {
    res.status(404).json({
      success: false,
      message: '声纹不存在或无权删除'
    })
    return
  }

  logger.info(`声纹删除成功: ${id} by user ${userId}`)

  res.json({
    success: true,
    message: '声纹删除成功'
  })
})

// 更新声纹信息
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

  const { id } = req.params
  const userId = req.user!._id
  const { name, email } = req.body

  const voiceprint = await voiceprintService.updateVoiceprint(id, userId, { name, email })

  if (!voiceprint) {
    res.status(404).json({
      success: false,
      message: '声纹不存在或无权更新'
    })
    return
  }

  logger.info(`声纹更新成功: ${id} by user ${userId}`)

  res.json({
    success: true,
    message: '声纹更新成功',
    data: { voiceprint }
  })
})

// 获取声纹统计信息
export const getVoiceprintStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 检查用户权限
  if (req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: '无权访问统计信息'
    })
    return
  }

  const stats = await voiceprintService.getVoiceprintStats()

  res.json({
    success: true,
    data: { stats }
  })
})

// 验证声纹质量
export const validateVoiceprint = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 检查是否有音频文件上传
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: '请上传音频文件'
    })
    return
  }

  try {
    // 将音频缓冲区转换为Float32Array进行质量评估
    const audioBuffer = req.file.buffer
    const float32Array = new Float32Array(audioBuffer.length / 2)

    // 假设16位音频数据
    const dataView = new DataView(audioBuffer.buffer)
    for (let i = 0; i < float32Array.length; i++) {
      const sample = dataView.getInt16(i * 2, true) // true为小端序
      float32Array[i] = sample / 32768.0 // 归一化到[-1, 1]范围
    }

    // 提取特征进行质量评估
    const features = voiceprintService.extractFeatures(float32Array)

    // 评估音频质量
    let maxAmplitude = 0
    let dcOffset = 0

    for (const sample of float32Array) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample))
      dcOffset += sample
    }

    dcOffset /= float32Array.length

    // 归一化
    const normalizedBuffer = float32Array.map(s => s - dcOffset)
    const rms = Math.sqrt(normalizedBuffer.reduce((sum, s) => sum + s * s, 0) / normalizedBuffer.length)

    // 评估质量
    let quality = 'unknown'
    if (rms < 0.01) quality = 'very_low'
    else if (rms < 0.05) quality = 'low'
    else if (rms < 0.1) quality = 'medium'
    else if (rms < 0.2) quality = 'good'
    else quality = 'excellent'

    // 检查音频长度
    const minSampleLength = 8000 // 最小样本长度 (1秒@8kHz)
    const duration = float32Array.length / 16000 // 假设16kHz采样率
    const isLengthValid = float32Array.length >= minSampleLength

    res.json({
      success: true,
      data: {
        quality: {
          overall: quality,
          rms: rms,
          maxAmplitude: maxAmplitude,
          dcOffset: dcOffset,
          duration: duration,
          isLengthValid: isLengthValid,
          features: features.length
        },
        recommendations: {
          canCreateVoiceprint: isLengthValid && rms >= 0.05,
          improveQuality: rms < 0.05 ? '音频信号太弱，请增大音量或靠近麦克风' : null,
          increaseDuration: !isLengthValid ? '音频长度不足，请提供至少1秒的音频' : null
        }
      }
    })
  } catch (error) {
    logger.error('声纹验证失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '声纹验证失败'
    })
  }
})