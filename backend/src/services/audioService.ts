// @ts-nocheck
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import ffmpeg from 'fluent-ffmpeg'
import { logger } from '@/utils/logger'

export interface AudioProcessingOptions {
  sampleRate?: number
  channels?: number
  bitrate?: number
  format?: string
}

export interface AudioMetadata {
  duration: number
  bitrate: number
  sampleRate: number
  channels: number
  format: string
  size: number
}

export class AudioService {
  private readonly uploadDir: string
  private readonly tempDir: string

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads'
    this.tempDir = path.join(this.uploadDir, 'temp')

    // 确保目录存在
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    const dirs = [this.uploadDir, this.tempDir]
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * 保存上传的音频文件
   */
  async saveAudioFile(buffer: Buffer, originalName: string): Promise<string> {
    const fileId = uuidv4()
    const extension = path.extname(originalName)
    const filename = `${fileId}${extension}`
    const filePath = path.join(this.uploadDir, filename)

    try {
      await fs.promises.writeFile(filePath, buffer)
      logger.info(`音频文件保存成功: ${filename}`)
      return filename
    } catch (error) {
      logger.error('保存音频文件失败:', error)
      throw new Error('保存音频文件失败')
    }
  }

  /**
   * 获取音频文件元数据
   */
  async getAudioMetadata(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('获取音频元数据失败:', err)
          reject(new Error('获取音频元数据失败'))
          return
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio')
        if (!audioStream) {
          reject(new Error('文件中没有音频流'))
          return
        }

        resolve({
          duration: metadata.format.duration || 0,
          bitrate: metadata.format.bit_rate || 0,
          sampleRate: audioStream.sample_rate || 0,
          channels: audioStream.channels || 0,
          format: metadata.format.format_name || 'unknown',
          size: metadata.format.size || 0
        })
      })
    })
  }

  /**
   * 转换音频格式
   */
  async convertAudio(
    inputPath: string,
    outputPath: string,
    options: AudioProcessingOptions = {}
  ): Promise<void> {
    const {
      sampleRate = 16000,
      channels = 1,
      bitrate = 128,
      format = 'wav'
    } = options

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioFrequency(sampleRate)
        .audioChannels(channels)
        .audioBitrate(bitrate)
        .format(format)
        .output(outputPath)

      command.on('end', () => {
        logger.info(`音频转换完成: ${inputPath} -> ${outputPath}`)
        resolve()
      })

      command.on('error', (err) => {
        logger.error('音频转换失败:', err)
        reject(new Error('音频转换失败'))
      })

      command.on('progress', (progress) => {
        logger.debug(`音频转换进度: ${progress.percent?.toFixed(2)}%`)
      })

      command.run()
    })
  }

  /**
   * 切割音频文件
   */
  async splitAudio(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .output(outputPath)

      command.on('end', () => {
        logger.info(`音频切割完成: ${inputPath} -> ${outputPath}`)
        resolve()
      })

      command.on('error', (err) => {
        logger.error('音频切割失败:', err)
        reject(new Error('音频切割失败'))
      })

      command.run()
    })
  }

  /**
   * 合并音频文件
   */
  async mergeAudio(inputPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()

      inputPaths.forEach(inputPath => {
        command.input(inputPath)
      })

      command
        .on('end', () => {
          logger.info(`音频合并完成: ${inputPaths.join(', ')} -> ${outputPath}`)
          resolve()
        })
        .on('error', (err) => {
          logger.error('音频合并失败:', err)
          reject(new Error('音频合并失败'))
        })
        .mergeToFile(outputPath)
    })
  }

  /**
   * 调整音频音量
   */
  async adjustVolume(
    inputPath: string,
    outputPath: string,
    volumeLevel: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioFilters(`volume=${volumeLevel}`)
        .output(outputPath)

      command.on('end', () => {
        logger.info(`音频音量调整完成: ${inputPath} -> ${outputPath}`)
        resolve()
      })

      command.on('error', (err) => {
        logger.error('音频音量调整失败:', err)
        reject(new Error('音频音量调整失败'))
      })

      command.run()
    })
  }

  /**
   * 降噪处理
   */
  async reduceNoise(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioFilters('highpass=200,lowpass=3000')
        .output(outputPath)

      command.on('end', () => {
        logger.info(`音频降噪完成: ${inputPath} -> ${outputPath}`)
        resolve()
      })

      command.on('error', (err) => {
        logger.error('音频降噪失败:', err)
        reject(new Error('音频降噪失败'))
      })

      command.run()
    })
  }

  /**
   * 删除音频文件
   */
  async deleteAudioFile(filename: string): Promise<void> {
    const filePath = path.join(this.uploadDir, filename)

    try {
      await fs.promises.unlink(filePath)
      logger.info(`音频文件删除成功: ${filename}`)
    } catch (error) {
      logger.error('删除音频文件失败:', error)
      throw new Error('删除音频文件失败')
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.tempDir)

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = await fs.promises.stat(filePath)

        // 删除超过1小时的临时文件
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          await fs.promises.unlink(filePath)
          logger.debug(`清理临时文件: ${file}`)
        }
      }
    } catch (error) {
      logger.error('清理临时文件失败:', error)
    }
  }

  /**
   * 获取文件大小
   */
  async getFileSize(filename: string): Promise<number> {
    const filePath = path.join(this.uploadDir, filename)

    try {
      const stats = await fs.promises.stat(filePath)
      return stats.size
    } catch (error) {
      logger.error('获取文件大小失败:', error)
      return 0
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.uploadDir, filename)

    try {
      await fs.promises.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取音频文件的完整路径
   */
  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename)
  }

  /**
   * 创建临时文件路径
   */
  createTempFilePath(extension: string): string {
    const filename = `${uuidv4()}.${extension}`
    return path.join(this.tempDir, filename)
  }
}

// 导出单例实例
export const audioService = new AudioService()