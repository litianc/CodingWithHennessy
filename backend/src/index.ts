import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { connectDatabase } from './config/database'
import { connectRedis } from './config/redis'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'
import apiRoutes from './routes'
import { initializeSocket } from './utils/socket'
import { setupTranscriptionHandlers } from './websocket/transcriptionHandler'

// 加载环境变量
dotenv.config()

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

// 基础中间件
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制每个 IP 100 次请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
})
app.use('/api', limiter)

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })
  next()
})

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// 静态文件服务（用于录音文件）
app.use('/api/recordings', express.static('uploads'))

// API 路由
app.use('/api', apiRoutes)

// 404 处理
app.use(notFoundHandler)

// 错误处理
app.use(errorHandler)

// 设置 Socket.IO 事件处理器
setupTranscriptionHandlers(io)

// 基础 Socket.IO 连接处理
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`)

  // 加入会议室
  socket.on('join-meeting', (meetingId: string) => {
    socket.join(`meeting-${meetingId}`)
    logger.info(`Client ${socket.id} joined meeting ${meetingId}`)
  })

  // 离开会议室
  socket.on('leave-meeting', (meetingId: string) => {
    socket.leave(`meeting-${meetingId}`)
    logger.info(`Client ${socket.id} left meeting ${meetingId}`)
  })

  // 断开连接
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// 启动服务器
const PORT = process.env.PORT || 5000

async function startServer() {
  try {
    // 连接数据库
    await connectDatabase()
    logger.info('Connected to MongoDB')

    // 连接 Redis
    await connectRedis()
    logger.info('Connected to Redis')

    // 初始化 Socket.IO
    initializeSocket(io)
    logger.info('Socket.IO initialized')

    // 启动服务器
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

// 启动服务器
startServer()

export { app, io }