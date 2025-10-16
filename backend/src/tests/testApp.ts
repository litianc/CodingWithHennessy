// @ts-nocheck
/**
 * 测试应用配置
 * 为测试环境提供Express应用实例
 */

import express from 'express'
import cors from 'cors'
import { errorHandler } from '@/middleware/errorHandler'
import { notFoundHandler } from '@/middleware/notFoundHandler'

// Import routes
import userRoutes from '@/routes/user'
import meetingRoutes from '@/routes/meeting'
import recordingRoutes from '@/routes/recording'
import transcriptionRoutes from '@/routes/transcription'
import aiRoutes from '@/routes/ai'
import emailRoutes from '@/routes/email'
import voiceprintRoutes from '@/routes/voiceprint'

// 创建Express应用
export const app = express()

// 中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: 'test' })
})

// API路由
app.use('/api/users', userRoutes)
app.use('/api/meetings', meetingRoutes)
app.use('/api/recordings', recordingRoutes)
app.use('/api/transcriptions', transcriptionRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/voiceprints', voiceprintRoutes)

// 错误处理
app.use(notFoundHandler)
app.use(errorHandler)

export default app
