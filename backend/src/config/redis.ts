import { createClient, RedisClientType } from 'redis'
import { logger } from '../utils/logger'

let redisClient: RedisClientType

export const connectRedis = async (): Promise<RedisClientType> => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    })

    // 错误处理
    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error)
    })

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully')
    })

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...')
    })

    redisClient.on('ready', () => {
      logger.info('Redis ready for commands')
    })

    await redisClient.connect()

    return redisClient
  } catch (error) {
    logger.error('Failed to connect to Redis:', error)
    throw error
  }
}

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.')
  }
  return redisClient
}

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit()
      logger.info('Redis connection closed')
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error)
    throw error
  }
}

// Redis 工具函数
export class RedisService {
  private client: RedisClientType

  constructor() {
    this.client = getRedisClient()
  }

  // 设置键值对
  async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    try {
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, value)
      } else {
        await this.client.set(key, value)
      }
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error)
      throw error
    }
  }

  // 获取值
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error)
      throw error
    }
  }

  // 删除键
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (error) {
      logger.error(`Redis del error for key ${key}:`, error)
      throw error
    }
  }

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error)
      throw error
    }
  }

  // 设置过期时间
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds)
    } catch (error) {
      logger.error(`Redis expire error for key ${key}:`, error)
      throw error
    }
  }

  // 获取剩余过期时间
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key)
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error)
      throw error
    }
  }

  // 哈希操作
  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value)
    } catch (error) {
      logger.error(`Redis hSet error for key ${key}, field ${field}:`, error)
      throw error
    }
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      return await this.client.hGet(key, field)
    } catch (error) {
      logger.error(`Redis hGet error for key ${key}, field ${field}:`, error)
      throw error
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key)
    } catch (error) {
      logger.error(`Redis hGetAll error for key ${key}:`, error)
      throw error
    }
  }

  // 列表操作
  async lPush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lPush(key, values)
    } catch (error) {
      logger.error(`Redis lPush error for key ${key}:`, error)
      throw error
    }
  }

  async rPop(key: string): Promise<string | null> {
    try {
      return await this.client.rPop(key)
    } catch (error) {
      logger.error(`Redis rPop error for key ${key}:`, error)
      throw error
    }
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lRange(key, start, stop)
    } catch (error) {
      logger.error(`Redis lRange error for key ${key}:`, error)
      throw error
    }
  }

  // 集合操作
  async sAdd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sAdd(key, members)
    } catch (error) {
      logger.error(`Redis sAdd error for key ${key}:`, error)
      throw error
    }
  }

  async sMembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key)
    } catch (error) {
      logger.error(`Redis sMembers error for key ${key}:`, error)
      throw error
    }
  }

  async sIsMember(key: string, member: string): Promise<boolean> {
    try {
      return await this.client.sIsMember(key, member)
    } catch (error) {
      logger.error(`Redis sIsMember error for key ${key}, member ${member}:`, error)
      throw error
    }
  }
}