/**
 * 阿里云OSS上传服务
 * 用于上传音频文件到OSS，以便使用录音文件识别API
 */

import OSS from 'ali-oss'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { logger } from '@/utils/logger'

export interface OSSConfig {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
  endpoint?: string
}

export interface UploadResult {
  url: string
  objectName: string
  size: number
}

export class OSSService {
  private client: OSS
  private config: OSSConfig

  constructor(config: OSSConfig) {
    this.config = config

    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      endpoint: config.endpoint
    })

    logger.info('OSS服务初始化成功', {
      bucket: config.bucket,
      region: config.region
    })
  }

  /**
   * 上传本地文件到OSS
   * @param filePath 本地文件路径
   * @param options 上传选项
   */
  async uploadFile(
    filePath: string,
    options?: {
      objectName?: string
      folder?: string
    }
  ): Promise<UploadResult> {
    try {
      // 获取文件信息
      const stats = await fs.stat(filePath)
      const fileName = path.basename(filePath)
      const fileExt = path.extname(filePath)

      // 生成对象名称
      const timestamp = Date.now()
      const randomStr = crypto.randomBytes(4).toString('hex')
      const defaultObjectName = `${options?.folder || 'audio'}/${timestamp}-${randomStr}${fileExt}`
      const objectName = options?.objectName || defaultObjectName

      logger.info('开始上传文件到OSS', {
        localPath: filePath,
        objectName,
        size: stats.size
      })

      // 上传文件
      const result = await this.client.put(objectName, filePath)

      logger.info('文件上传成功', {
        url: result.url,
        objectName,
        size: stats.size
      })

      return {
        url: result.url,
        objectName,
        size: stats.size
      }
    } catch (error) {
      logger.error('文件上传失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`OSS上传失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 上传Buffer到OSS
   * @param buffer 文件Buffer
   * @param fileName 文件名
   * @param options 上传选项
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    options?: {
      folder?: string
    }
  ): Promise<UploadResult> {
    try {
      // 生成对象名称
      const timestamp = Date.now()
      const randomStr = crypto.randomBytes(4).toString('hex')
      const fileExt = path.extname(fileName)
      const objectName = `${options?.folder || 'audio'}/${timestamp}-${randomStr}${fileExt}`

      logger.info('开始上传Buffer到OSS', {
        objectName,
        size: buffer.length
      })

      // 上传Buffer
      const result = await this.client.put(objectName, buffer)

      logger.info('Buffer上传成功', {
        url: result.url,
        objectName,
        size: buffer.length
      })

      return {
        url: result.url,
        objectName,
        size: buffer.length
      }
    } catch (error) {
      logger.error('Buffer上传失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`OSS上传失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 删除OSS中的文件
   * @param objectName 对象名称
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.client.delete(objectName)
      logger.info('文件删除成功', { objectName })
    } catch (error) {
      logger.error('文件删除失败', {
        objectName,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`OSS删除失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 生成签名URL（用于临时访问）
   * @param objectName 对象名称
   * @param expiresIn 过期时间（秒），默认1小时
   */
  async getSignedUrl(objectName: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = this.client.signatureUrl(objectName, { expires: expiresIn })
      logger.info('生成签名URL成功', { objectName, expiresIn })
      return url
    } catch (error) {
      logger.error('生成签名URL失败', {
        objectName,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`生成签名URL失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 检查文件是否存在
   * @param objectName 对象名称
   */
  async exists(objectName: string): Promise<boolean> {
    try {
      await this.client.head(objectName)
      return true
    } catch (error: any) {
      if (error.code === 'NoSuchKey') {
        return false
      }
      throw error
    }
  }

  /**
   * 列出指定前缀的文件
   * @param prefix 文件前缀
   * @param maxKeys 最大返回数量
   */
  async listFiles(prefix: string = '', maxKeys: number = 100): Promise<OSS.ObjectMeta[]> {
    try {
      const result = await this.client.list({
        prefix,
        'max-keys': maxKeys
      })
      return result.objects || []
    } catch (error) {
      logger.error('列出文件失败', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`列出文件失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// 创建OSS服务实例
export const ossService = new OSSService({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  bucket: process.env.ALIBABA_CLOUD_OSS_BUCKET || '',
  region: process.env.ALIBABA_CLOUD_OSS_REGION || '',
  endpoint: process.env.ALIBABA_CLOUD_OSS_ENDPOINT
})
