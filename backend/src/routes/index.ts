import { Router } from 'express'
import meetingRoutes from './meeting'
import recordingRoutes from './recording'
import transcriptionRoutes from './transcription'
import voiceprintRoutes from './voiceprint'
import aiRoutes from './ai'
import emailRoutes from './email'
import userRoutes from './user'

const router = Router()

// API 版本
router.get('/', (req, res) => {
  res.json({
    message: '智能会议纪要 API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// 路由挂载
router.use('/users', userRoutes)
router.use('/meetings', meetingRoutes)
router.use('/recordings', recordingRoutes)
router.use('/transcriptions', transcriptionRoutes)
router.use('/voiceprints', voiceprintRoutes)
router.use('/ai', aiRoutes)
router.use('/email', emailRoutes)

export default router