import { Router } from 'express'
import {
  uploadAndRecognizeAudio,
  uploadAndRecognizeAudioSync,
  getSupportedFormats
} from '@/controllers/fileTransController'
import { authenticateToken } from '@/middleware/auth'
import { upload } from '@/middleware/upload'

const router = Router()

// 所有路由都需要认证
router.use(authenticateToken)

// 获取支持的音频格式信息
router.get('/formats', getSupportedFormats)

// 上传音频并识别（异步，立即返回）
router.post(
  '/recognize',
  upload.single('audio'),
  uploadAndRecognizeAudio
)

// 上传音频并识别（同步，等待完成）
router.post(
  '/recognize-sync',
  upload.single('audio'),
  uploadAndRecognizeAudioSync
)

export default router
