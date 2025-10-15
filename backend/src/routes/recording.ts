import { Router } from 'express'
import {
  startRecording,
  stopRecording,
  uploadAudio,
  getRecording,
  deleteRecording,
  uploadMiddleware
} from '@/controllers/recordingController'
import { authenticateToken } from '@/middleware/auth'
import { body } from 'express-validator'

const router = Router()

// 所有录音路由都需要认证
router.use(authenticateToken)

// 开始录音
router.post('/start', [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效')
], startRecording)

// 停止录音
router.post('/stop', [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效')
], stopRecording)

// 上传音频文件
router.post('/upload', [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效')
], uploadMiddleware, uploadAudio)

// 获取录音文件
router.get('/:filename', getRecording)

// 删除录音
router.delete('/:meetingId', deleteRecording)

export default router