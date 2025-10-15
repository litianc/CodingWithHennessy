import { Router } from 'express'
import {
  chatWithAI,
  streamChatWithAI,
  generateMeetingMinutes,
  optimizeMeetingMinutes,
  approveMeetingMinutes,
  getMeetingMinutes,
  checkAIStatus
} from '@/controllers/aiController'
import { authenticateToken } from '@/middleware/auth'
import {
  validateChatWithAI,
  validateGenerateMeetingMinutes,
  validateOptimizeMeetingMinutes
} from '@/validators/aiValidators'

const router = Router()

// 所有AI路由都需要认证
router.use(authenticateToken)

// AI聊天
router.post('/chat', validateChatWithAI, chatWithAI)

// 流式AI聊天
router.post('/chat/stream', validateChatWithAI, streamChatWithAI)

// 生成会议纪要
router.post('/minutes/generate', validateGenerateMeetingMinutes, generateMeetingMinutes)

// 优化会议纪要
router.post('/minutes/optimize', validateOptimizeMeetingMinutes, optimizeMeetingMinutes)

// 批准会议纪要
router.post('/minutes/:meetingId/approve', approveMeetingMinutes)

// 获取会议纪要
router.get('/minutes/:meetingId', getMeetingMinutes)

// 检查AI服务状态
router.get('/status', checkAIStatus)

export default router