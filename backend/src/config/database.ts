import mongoose from 'mongoose'
import { logger } from '../utils/logger'

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-agent'

    await mongoose.connect(mongoUri)

    logger.info('MongoDB connected successfully')

    // 监听连接事件
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected')
    })

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close()
    logger.info('MongoDB connection closed')
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error)
    throw error
  }
}