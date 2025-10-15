// @ts-nocheck
import { Router } from 'express'
import { body } from 'express-validator'
import {
  getUserVoiceprints,
  createVoiceprint,
  matchVoiceprint,
  deleteVoiceprint,
  updateVoiceprint,
  getVoiceprintStats,
  validateVoiceprint
} from '@/controllers/voiceprintController'
import { authenticateToken } from '@/middleware/auth'
import { upload } from '@/middleware/upload'

const router = Router()

// 所有声纹相关路由都需要认证
router.use(authenticateToken)

// 获取用户声纹列表
router.get('/', getUserVoiceprints)

// 验证声纹质量
router.post('/validate', upload.single('audio'), validateVoiceprint)

// 创建声纹
router.post('/',
  upload.single('audio'),
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('姓名长度必须在1-50个字符之间'),
    body('email')
      .isEmail()
      .withMessage('请输入有效的邮箱地址')
      .normalizeEmail(),
    body('metadata.deviceInfo')
      .optional()
      .isString()
      .withMessage('设备信息必须是字符串'),
    body('metadata.recordingEnvironment')
      .optional()
      .isString()
      .withMessage('录音环境必须是字符串')
  ],
  createVoiceprint
)

// 匹配音纹
router.post('/match',
  upload.single('audio'),
  matchVoiceprint
)

// 获取声纹统计信息 (仅管理员)
router.get('/stats', getVoiceprintStats)

// 更新声纹信息
router.put('/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('姓名长度必须在1-50个字符之间'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('请输入有效的邮箱地址')
      .normalizeEmail()
  ],
  updateVoiceprint
)

// 删除声纹
router.delete('/:id', deleteVoiceprint)

export default router