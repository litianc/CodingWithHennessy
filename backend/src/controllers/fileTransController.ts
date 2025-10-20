import { Request, Response } from 'express'
import { fileTransService } from '@/services/fileTransService'
import { logger } from '@/utils/logger'
import fs from 'fs/promises'

/**
 * 上传音频文件并识别
 */
export const uploadAndRecognizeAudio = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件'
      })
    }

    const file = req.file
    logger.info('收到音频文件上传请求', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    })

    // 验证文件格式
    const allowedMimeTypes = [
      'audio/mpeg',      // MP3
      'audio/wav',       // WAV
      'audio/x-wav',     // WAV
      'audio/mp4',       // M4A
      'audio/x-m4a',     // M4A
      'audio/flac',      // FLAC
      'audio/ogg'        // OGG
    ]

    if (!allowedMimeTypes.includes(file.mimetype)) {
      // 删除上传的文件
      await fs.unlink(file.path)
      return res.status(400).json({
        success: false,
        error: '不支持的音频格式，请上传 MP3, WAV, M4A 或 FLAC 格式的音频文件'
      })
    }

    // 验证文件大小 (最大 512MB)
    const maxSize = 512 * 1024 * 1024 // 512MB
    if (file.size > maxSize) {
      await fs.unlink(file.path)
      return res.status(400).json({
        success: false,
        error: '文件太大，最大支持 512MB 的音频文件'
      })
    }

    // 发送初始响应，让客户端知道开始处理
    res.status(202).json({
      success: true,
      message: '文件上传成功，开始识别...',
      filename: file.originalname,
      size: file.size
    })

    // 异步处理识别
    processRecognition(file.path, file.originalname, req.body.meetingId).catch(error => {
      logger.error('音频识别异步处理失败', {
        error: error.message,
        filename: file.originalname
      })
    })

  } catch (error) {
    logger.error('音频上传失败', {
      error: error instanceof Error ? error.message : String(error)
    })

    res.status(500).json({
      success: false,
      error: '音频上传失败，请稍后重试'
    })
  }
}

/**
 * 异步处理音频识别
 */
async function processRecognition(filePath: string, filename: string, meetingId?: string) {
  try {
    logger.info('开始音频识别', { filename, meetingId })

    // 调用FileTrans服务
    const transcripts = await fileTransService.recognizeFile(filePath, {
      enableWords: true,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
      maxWaitTime: 600000,  // 10分钟
      deleteAfterRecognition: true
    })

    logger.info('音频识别完成', {
      filename,
      transcriptCount: transcripts.length,
      meetingId
    })

    // TODO: 如果提供了meetingId，将识别结果保存到数据库
    // 这里可以通过WebSocket发送识别结果给前端

    // 删除临时文件
    try {
      await fs.unlink(filePath)
    } catch (error) {
      logger.warn('删除临时文件失败', { filePath })
    }

    return transcripts

  } catch (error) {
    logger.error('音频识别处理失败', {
      error: error instanceof Error ? error.message : String(error),
      filename
    })

    // 清理临时文件
    try {
      await fs.unlink(filePath)
    } catch (cleanupError) {
      logger.warn('删除临时文件失败', { filePath })
    }

    throw error
  }
}

/**
 * 同步上传并识别（返回完整结果）
 */
export const uploadAndRecognizeAudioSync = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未上传文件'
      })
    }

    const file = req.file
    logger.info('收到音频文件上传请求（同步）', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    })

    // 验证文件格式
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/flac',
      'audio/ogg'
    ]

    if (!allowedMimeTypes.includes(file.mimetype)) {
      await fs.unlink(file.path)
      return res.status(400).json({
        success: false,
        error: '不支持的音频格式'
      })
    }

    // 验证文件大小
    const maxSize = 512 * 1024 * 1024
    if (file.size > maxSize) {
      await fs.unlink(file.path)
      return res.status(400).json({
        success: false,
        error: '文件太大，最大支持 512MB'
      })
    }

    // 调用FileTrans服务（同步等待）
    const transcripts = await fileTransService.recognizeFile(file.path, {
      enableWords: true,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
      maxWaitTime: 600000,
      deleteAfterRecognition: true
    })

    // 删除临时文件
    try {
      await fs.unlink(file.path)
    } catch (error) {
      logger.warn('删除临时文件失败', { path: file.path })
    }

    // 返回识别结果
    res.json({
      success: true,
      data: {
        filename: file.originalname,
        size: file.size,
        transcriptCount: transcripts.length,
        transcripts: transcripts
      }
    })

  } catch (error) {
    logger.error('音频识别失败', {
      error: error instanceof Error ? error.message : String(error)
    })

    // 清理临时文件
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path)
      } catch (cleanupError) {
        logger.warn('删除临时文件失败', { path: req.file.path })
      }
    }

    res.status(500).json({
      success: false,
      error: '音频识别失败，请稍后重试'
    })
  }
}

/**
 * 获取支持的音频格式信息
 */
export const getSupportedFormats = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      formats: [
        {
          format: 'MP3',
          mimeType: 'audio/mpeg',
          extension: '.mp3',
          recommended: true
        },
        {
          format: 'WAV',
          mimeType: 'audio/wav',
          extension: '.wav',
          recommended: true
        },
        {
          format: 'M4A',
          mimeType: 'audio/mp4',
          extension: '.m4a',
          recommended: false
        },
        {
          format: 'FLAC',
          mimeType: 'audio/flac',
          extension: '.flac',
          recommended: false
        }
      ],
      requirements: {
        maxSize: '512MB',
        maxDuration: '5 hours',
        recommendedSampleRate: '16000 Hz',
        recommendedChannels: 'Mono (单声道)'
      },
      tips: [
        '推荐使用16kHz采样率的单声道音频',
        '如果采样率不符合要求，系统会自动转换',
        '支持的最大文件大小为512MB',
        '支持的最长音频时长为5小时'
      ]
    }
  })
}
