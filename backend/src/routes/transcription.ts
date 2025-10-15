import { Router } from 'express'
import {
  transcribeFromFile,
  getTranscriptions,
  updateTranscription,
  deleteTranscription,
  updateSpeakerInfo
} from '@/controllers/transcriptionController'
import { authenticateToken } from '@/middleware/auth'
import {
  validateTranscribeFromFile,
  validateUpdateTranscription,
  validateUpdateSpeakerInfo
} from '@/validators/transcriptionValidators'
import { body } from 'express-validator'

const router = Router()

// 所有转录路由都需要认证
router.use(authenticateToken)

// 从音频文件生成转录
router.post('/transcribe', validateTranscribeFromFile, transcribeFromFile)

// 获取会议转录记录
router.get('/meetings/:meetingId', [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是正整数'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须在1-100之间')
], getTranscriptions)

// 更新转录记录
router.put('/:meetingId/:transcriptionId', validateUpdateTranscription, updateTranscription)

// 删除转录记录
router.delete('/:meetingId/:transcriptionId', deleteTranscription)

// 批量更新说话人信息
router.put('/:meetingId/speaker-info', validateUpdateSpeakerInfo, updateSpeakerInfo)

export default router