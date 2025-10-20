/**
 * 阿里云录音文件识别服务
 * 支持大文件、长音频的异步识别
 */

import RPCClient from '@alicloud/pop-core'
import { logger } from '@/utils/logger'
import { ossService } from './ossService'
import type { TranscriptionResult } from './speechRecognitionService'

export interface FileTransConfig {
  accessKeyId: string
  accessKeySecret: string
  appKey: string
  region: string
}

export interface FileTransTask {
  appkey: string
  file_link: string
  version: string
  enable_words?: boolean
  enable_inverse_text_normalization?: boolean
  enable_punctuation_prediction?: boolean
  max_single_segment_time?: number
}

export interface FileTransResult {
  taskId: string
  status: 'QUEUING' | 'RUNNING' | 'SUCCESS' | 'SUCCESS_WITH_NO_VALID_FRAGMENT' | 'FAILED'
  statusText?: string
  result?: string
  transcripts?: TranscriptionResult[]
}

export class FileTransService {
  private client: RPCClient
  private config: FileTransConfig
  private domain: string

  constructor(config: FileTransConfig) {
    this.config = config
    this.domain = `filetrans.${config.region}.aliyuncs.com`

    this.client = new RPCClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: `https://${this.domain}`,
      apiVersion: '2018-08-17'
    })

    logger.info('录音文件识别服务初始化', {
      region: config.region,
      domain: this.domain
    })
  }

  /**
   * 提交录音文件识别任务
   * @param fileUrl 文件URL（必须是公网可访问的HTTP URL）
   * @param options 识别选项
   */
  async submitTask(
    fileUrl: string,
    options?: {
      enableWords?: boolean
      enablePunctuation?: boolean
      enableInverseTextNormalization?: boolean
      maxSingleSegmentTime?: number
    }
  ): Promise<string> {
    try {
      const task: FileTransTask = {
        appkey: this.config.appKey,
        file_link: fileUrl,
        version: '4.0',
        enable_words: options?.enableWords !== false,
        enable_punctuation_prediction: options?.enablePunctuation !== false,
        enable_inverse_text_normalization: options?.enableInverseTextNormalization !== false,
        max_single_segment_time: options?.maxSingleSegmentTime || 15000
      }

      logger.info('提交录音文件识别任务', {
        fileUrl,
        task
      })

      const params = {
        RegionId: this.config.region,
        Task: JSON.stringify(task)
      }

      const requestOption = {
        method: 'POST',
        formatParams: false
      }

      const response = await this.client.request('SubmitTask', params, requestOption) as any

      if (!response || !response.TaskId) {
        throw new Error('提交任务失败: 未返回TaskId')
      }

      const taskId = response.TaskId

      logger.info('任务提交成功', {
        taskId,
        statusText: response.StatusText
      })

      return taskId
    } catch (error) {
      logger.error('提交录音文件识别任务失败', {
        fileUrl,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      throw new Error(`提交任务失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 查询任务结果
   * @param taskId 任务ID
   */
  async getTaskResult(taskId: string): Promise<FileTransResult> {
    try {
      logger.debug('查询任务结果', { taskId })

      const params = {
        RegionId: this.config.region,
        TaskId: taskId
      }

      const requestOption = {
        method: 'GET',
        formatParams: false
      }

      const response = await this.client.request('GetTaskResult', params, requestOption) as any

      const status = response.StatusText as FileTransResult['status']

      logger.debug('任务状态', {
        taskId,
        status,
        statusText: response.StatusText
      })

      const result: FileTransResult = {
        taskId,
        status,
        statusText: response.StatusText
      }

      // 如果任务成功或成功但无有效片段，解析结果
      if ((status === 'SUCCESS' || status === 'SUCCESS_WITH_NO_VALID_FRAGMENT') && response.Result) {
        result.result = response.Result

        // 解析为TranscriptionResult格式
        try {
          // Result 可能已经是对象，也可能是字符串
          const resultData = typeof response.Result === 'string'
            ? JSON.parse(response.Result)
            : response.Result

          // 处理 Sentences 格式（句子级别）
          if (resultData.Sentences && Array.isArray(resultData.Sentences)) {
            result.transcripts = resultData.Sentences.map((sentence: any) => ({
              text: sentence.Text || '',
              confidence: 1.0,
              startTime: sentence.BeginTime || 0,
              endTime: sentence.EndTime || 0,
              speakerId: sentence.SpeakerId,
              channelId: sentence.ChannelId
            }))
          }
          // 处理 Words 格式（词级别），需要组合成句子
          else if (resultData.Words && Array.isArray(resultData.Words)) {
            // 将词组合成句子（按时间间隔分组）
            const words = resultData.Words
            const sentences: any[] = []
            let currentSentence: any = null
            const maxGap = 1000 // 1秒间隔认为是新句子

            for (const word of words) {
              if (!currentSentence || (word.BeginTime - currentSentence.endTime > maxGap)) {
                // 开始新句子
                if (currentSentence) {
                  sentences.push(currentSentence)
                }
                currentSentence = {
                  text: word.Word,
                  confidence: 1.0,
                  startTime: word.BeginTime,
                  endTime: word.EndTime,
                  channelId: word.ChannelId
                }
              } else {
                // 追加到当前句子
                currentSentence.text += word.Word
                currentSentence.endTime = word.EndTime
              }
            }

            // 添加最后一个句子
            if (currentSentence) {
              sentences.push(currentSentence)
            }

            result.transcripts = sentences
          }
        } catch (parseError) {
          logger.warn('解析识别结果失败', {
            taskId,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          })
        }
      }

      return result
    } catch (error) {
      logger.error('查询任务结果失败', {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`查询任务失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 等待任务完成（轮询）
   * @param taskId 任务ID
   * @param options 轮询选项
   */
  async waitForTaskComplete(
    taskId: string,
    options?: {
      maxWaitTime?: number // 最大等待时间（毫秒）
      pollInterval?: number // 轮询间隔（毫秒）
    }
  ): Promise<FileTransResult> {
    const maxWaitTime = options?.maxWaitTime || 300000 // 默认5分钟
    const pollInterval = options?.pollInterval || 3000 // 默认3秒

    const startTime = Date.now()

    logger.info('开始等待任务完成', {
      taskId,
      maxWaitTime,
      pollInterval
    })

    while (true) {
      // 检查是否超时
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`任务等待超时: ${maxWaitTime}ms`)
      }

      // 查询任务状态
      const result = await this.getTaskResult(taskId)

      // 如果任务完成或失败，返回结果
      if (result.status === 'SUCCESS' || result.status === 'SUCCESS_WITH_NO_VALID_FRAGMENT' || result.status === 'FAILED') {
        logger.info('任务完成', {
          taskId,
          status: result.status,
          duration: Date.now() - startTime
        })
        return result
      }

      // 等待一段时间后继续轮询
      logger.debug('任务仍在处理中，继续等待', {
        taskId,
        status: result.status,
        elapsed: Date.now() - startTime
      })

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  /**
   * 识别本地文件（先上传到OSS，再提交识别任务）
   * @param filePath 本地文件路径
   * @param options 识别选项
   */
  async recognizeFile(
    filePath: string,
    options?: {
      enableWords?: boolean
      enablePunctuation?: boolean
      enableInverseTextNormalization?: boolean
      maxWaitTime?: number
      deleteAfterRecognition?: boolean // 识别完成后是否删除OSS文件
      signedUrlExpires?: number // 签名URL过期时间（秒），默认2小时
    }
  ): Promise<TranscriptionResult[]> {
    let uploadResult: { url: string; objectName: string } | null = null

    try {
      logger.info('开始识别本地文件', { filePath })

      // 1. 上传文件到OSS
      logger.info('步骤1: 上传文件到OSS')
      uploadResult = await ossService.uploadFile(filePath, {
        folder: 'temp-audio'
      })

      logger.info('文件上传成功', {
        url: uploadResult.url,
        objectName: uploadResult.objectName
      })

      // 2. 生成签名URL（用于私有Bucket）
      // 签名URL有效期需要足够长，确保识别任务能够访问文件
      const signedUrlExpires = options?.signedUrlExpires || 7200 // 默认2小时
      logger.info('步骤2: 生成签名URL', { expires: signedUrlExpires })

      const signedUrl = await ossService.getSignedUrl(
        uploadResult.objectName,
        signedUrlExpires
      )

      logger.info('签名URL生成成功', {
        objectName: uploadResult.objectName,
        expires: signedUrlExpires
      })

      // 3. 提交识别任务（使用签名URL）
      logger.info('步骤3: 提交识别任务（使用签名URL）')
      const taskId = await this.submitTask(signedUrl, options)

      // 4. 等待任务完成
      logger.info('步骤4: 等待任务完成')
      const result = await this.waitForTaskComplete(taskId, {
        maxWaitTime: options?.maxWaitTime
      })

      // 5. 检查结果
      if (result.status === 'FAILED') {
        throw new Error(`识别失败: ${result.statusText || '未知错误'}`)
      }

      if (!result.transcripts || result.transcripts.length === 0) {
        logger.warn('识别成功但未返回文本')
        return []
      }

      logger.info('识别成功', {
        taskId,
        transcriptCount: result.transcripts.length
      })

      return result.transcripts
    } catch (error) {
      logger.error('识别文件失败', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    } finally {
      // 6. 清理OSS文件（如果需要）
      if (uploadResult && options?.deleteAfterRecognition !== false) {
        try {
          logger.info('清理OSS文件', { objectName: uploadResult.objectName })
          await ossService.deleteFile(uploadResult.objectName)
        } catch (cleanupError) {
          logger.warn('清理OSS文件失败', {
            objectName: uploadResult.objectName,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          })
        }
      }
    }
  }
}

// 创建服务实例
export const fileTransService = new FileTransService({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  appKey: process.env.ALIBABA_CLOUD_APP_KEY || '',
  region: process.env.ALIBABA_CLOUD_REGION || 'cn-shanghai'
})
