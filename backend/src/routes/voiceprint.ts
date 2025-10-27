// @ts-nocheck
import { Router } from 'express'
import { body } from 'express-validator'
import {
  registerVoiceprint,
  getVoiceprintList,
  getVoiceprintDetails,
  updateVoiceprint,
  deleteVoiceprint,
  addAudioSamples,
  getVoiceprintStats,
  uploadMultiple
} from '@/controllers/voiceprintController'
import { authenticateToken } from '@/middleware/auth'

const router = Router()

// 所有声纹相关路由都需要认证
router.use(authenticateToken)

/**
 * POST /api/voiceprint/register
 * 注册声纹
 */
router.post('/register',
  uploadMultiple,
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('姓名长度必须在1-100个字符之间'),
    body('department')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('部门名称不能超过100个字符'),
    body('position')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('职位名称不能超过100个字符'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('请输入有效的邮箱地址')
      .normalizeEmail(),
    body('phone')
      .optional()
      .trim(),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic必须是布尔值'),
    body('allowedUsers')
      .optional()
      .isString()
      .withMessage('allowedUsers必须是JSON字符串')
  ],
  registerVoiceprint
)

/**
 * GET /api/voiceprint/list
 * 获取声纹列表（支持分页和筛选）
 */
router.get('/list', getVoiceprintList)

/**
 * GET /api/voiceprint/stats
 * 获取声纹统计信息
 */
router.get('/stats', getVoiceprintStats)

/**
 * GET /api/voiceprint/:id
 * 获取声纹详情
 */
router.get('/:id', getVoiceprintDetails)

/**
 * PUT /api/voiceprint/:id
 * 更新声纹信息
 */
router.put('/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('姓名长度必须在1-100个字符之间'),
    body('department')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('部门名称不能超过100个字符'),
    body('position')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('职位名称不能超过100个字符'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('请输入有效的邮箱地址')
      .normalizeEmail(),
    body('phone')
      .optional()
      .trim(),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic必须是布尔值'),
    body('allowedUsers')
      .optional()
      .isArray()
      .withMessage('allowedUsers必须是数组')
  ],
  updateVoiceprint
)

/**
 * DELETE /api/voiceprint/:id
 * 删除声纹（软删除）
 */
router.delete('/:id', deleteVoiceprint)

/**
 * POST /api/voiceprint/:id/samples
 * 添加音频样本
 */
router.post('/:id/samples',
  uploadMultiple,
  addAudioSamples
)

export default router
