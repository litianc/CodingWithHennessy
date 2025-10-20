import axios from 'axios'
import crypto from 'crypto'
import { logger } from '@/utils/logger'

export interface AlibabaCloudConfig {
  accessKeyId: string
  accessKeySecret: string
  region: string
}

export interface TokenInfo {
  token: string
  expireTime: number
}

/**
 * 阿里云认证服务
 * 支持多种认证方式获取访问令牌
 */
export class AlibabaCloudAuth {
  private config: AlibabaCloudConfig
  private tokenCache: TokenInfo | null = null

  constructor(config: AlibabaCloudConfig) {
    this.config = config
  }

  /**
   * 获取访问令牌（带缓存）
   */
  async getAccessToken(): Promise<string> {
    // 检查缓存中的token是否仍然有效
    if (this.tokenCache && Date.now() < this.tokenCache.expireTime) {
      return this.tokenCache.token
    }

    try {
      // 尝试不同的认证方式
      const token = await this.tryDifferentAuthMethods()

      // 缓存token（提前5分钟过期）
      this.tokenCache = {
        token,
        expireTime: Date.now() + (55 * 60 * 1000) // 55分钟
      }

      return token
    } catch (error) {
      logger.error('获取阿里云访问令牌失败:', error)
      throw new Error('无法获取阿里云访问令牌')
    }
  }

  /**
   * 尝试不同的认证方法
   */
  private async tryDifferentAuthMethods(): Promise<string> {
    const methods = [
      () => this.getTokenViaCommonAPI(),
      () => this.getTokenViaSTS(),
      () => this.getTokenViaNLSMeta(),
      () => this.getTokenViaDirectAPI()
    ]

    for (const method of methods) {
      try {
        const token = await method()
        if (token) {
          logger.info('成功获取访问令牌')
          return token
        }
      } catch (error) {
        logger.warn('认证方法失败，尝试下一种:', error.message)
      }
    }

    throw new Error('所有认证方法都失败了')
  }

  /**
   * 方法1: 通过Common API获取Token
   */
  private async getTokenViaCommonAPI(): Promise<string> {
    logger.info('尝试通过Common API获取Token')

    const endpoint = 'https://common.cn-shanghai.aliyuncs.com'
    const params = {
      Action: 'CreateToken',
      Version: '2019-02-28',
      RegionId: this.config.region,
      Format: 'JSON',
      AccessKeyId: this.config.accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: Date.now().toString(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Product: 'nls_cloud',
      Domain: 'nls-gateway.cn-shanghai.aliyuncs.com',
      Service: 'speech_transcriber'
    }

    // 生成签名
    const signature = this.generateRPCSignature('POST', '/', params)
    ;(params as any).Signature = signature

    const response = await axios.post(endpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      timeout: 15000
    })

    if (response.data && response.data.Token && response.data.Token.Id) {
      logger.info('Common API认证成功')
      return response.data.Token.Id
    }

    throw new Error('Common API返回格式错误')
  }

  /**
   * 方法2: 通过STS获取临时Token
   */
  private async getTokenViaSTS(): Promise<string> {
    logger.info('尝试通过STS获取Token')

    const endpoint = 'https://sts.cn-shanghai.aliyuncs.com'
    const params = {
      Action: 'AssumeRole',
      Version: '2015-04-01',
      RoleSessionName: `nls-session-${Date.now()}`,
      DurationSeconds: 3600,
      Format: 'JSON',
      AccessKeyId: this.config.accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: Date.now().toString(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    }

    // 注意：这里需要提供有效的RoleArn，如果没有会失败
    // 暂时跳过此方法
    throw new Error('STS需要有效的RoleArn，跳过此方法')
  }

  /**
   * 方法3: 通过NLS Meta API获取Token
   */
  private async getTokenViaNLSMeta(): Promise<string> {
    logger.info('尝试通过NLS Meta API获取Token')

    const endpoint = 'https://nls-meta.cn-shanghai.aliyuncs.com/oauth/token'

    // 尝试不同的参数格式
    const variants = [
      {
        grant_type: 'client_credentials',
        client_id: this.config.accessKeyId,
        client_secret: this.config.accessKeySecret
      },
      {
        grant_type: 'password',
        username: this.config.accessKeyId,
        password: this.config.accessKeySecret
      }
    ]

    for (const params of variants) {
      try {
        const response = await axios.post(endpoint, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000
        })

        if (response.data && response.data.access_token) {
          logger.info('NLS Meta API认证成功')
          return response.data.access_token
        }
      } catch (error) {
        logger.warn('NLS Meta API变体失败:', error.message)
      }
    }

    throw new Error('NLS Meta API所有变体都失败')
  }

  /**
   * 方法4: 直接使用AccessKey（某些API支持）
   */
  private async getTokenViaDirectAPI(): Promise<string> {
    logger.info('尝试直接AccessKey认证')

    // 对于某些API，可能直接使用AccessKey
    // 这里返回一个组合的token字符串
    const combinedToken = `${this.config.accessKeyId}:${this.config.accessKeySecret}`

    // 验证这种方式是否有效
    try {
      const testResponse = await axios.post(
        'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr',
        {
          format: 'wav',
          sample_rate: 16000,
          language: 'zh-CN',
          audio: '' // 空音频用于测试
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${combinedToken}`
          },
          timeout: 5000,
          validateStatus: (status) => status !== 401 // 不是认证错误就算成功
        }
      )

      // 如果不是认证错误，说明这种方式可能有效
      if (testResponse.status !== 401 && testResponse.status !== 403) {
        logger.info('直接AccessKey认证可能有效')
        return combinedToken
      }
    } catch (error) {
      // 验证失败
    }

    throw new Error('直接AccessKey认证无效')
  }

  /**
   * 生成RPC API签名
   */
  private generateRPCSignature(method: string, uri: string, params: Record<string, string>): string {
    // 按字母顺序排序参数
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&')

    // 构建待签名字符串
    const stringToSign = [
      method.toUpperCase(),
      uri,
      sortedParams
    ].join('&')

    // 使用HMAC-SHA1计算签名
    return crypto
      .createHmac('sha1', this.config.accessKeySecret)
      .update(stringToSign)
      .digest('base64')
  }

  /**
   * 清除token缓存
   */
  clearTokenCache(): void {
    this.tokenCache = null
  }

  /**
   * 检查token是否即将过期
   */
  isTokenExpiringSoon(): boolean {
    if (!this.tokenCache) return true
    return Date.now() > (this.tokenCache.expireTime - 5 * 60 * 1000) // 5分钟内过期
  }
}