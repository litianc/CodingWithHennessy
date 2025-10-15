import { body } from 'express-validator'

// 创建会议验证
export const validateCreateMeeting = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('会议标题长度必须在 1-100 个字符之间'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('会议描述长度不能超过 500 个字符'),

  body('participants')
    .optional()
    .isArray()
    .withMessage('参与者列表必须是数组'),

  body('participants.*.name')
    .if(body('participants').exists())
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('参与者姓名长度必须在 1-50 个字符之间'),

  body('participants.*.email')
    .if(body('participants').exists())
    .trim()
    .isEmail()
    .withMessage('参与者邮箱格式无效')
    .normalizeEmail(),

  body('participants.*.role')
    .optional()
    .isIn(['participant', 'observer'])
    .withMessage('参与者角色无效'),

  body('scheduledStartTime')
    .optional()
    .isISO8601()
    .withMessage('计划开始时间格式无效'),

  body('scheduledEndTime')
    .optional()
    .isISO8601()
    .withMessage('计划结束时间格式无效')
    .custom((value, { req }) => {
      if (req.body.scheduledStartTime && value && new Date(value) <= new Date(req.body.scheduledStartTime)) {
        throw new Error('计划结束时间必须晚于开始时间')
      }
      return true
    }),

  body('settings.allowRecording')
    .optional()
    .isBoolean()
    .withMessage('允许录制设置必须是布尔值'),

  body('settings.enableTranscription')
    .optional()
    .isBoolean()
    .withMessage('启用转录设置必须是布尔值'),

  body('settings.enableVoiceprint')
    .optional()
    .isBoolean()
    .withMessage('启用声纹识别设置必须是布尔值'),

  body('settings.autoGenerateMinutes')
    .optional()
    .isBoolean()
    .withMessage('自动生成纪要设置必须是布尔值'),

  body('settings.language')
    .optional()
    .isIn(['zh-CN', 'en-US', 'auto'])
    .withMessage('语言设置无效'),
]

// 更新会议验证
export const validateUpdateMeeting = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('会议标题长度必须在 1-100 个字符之间'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('会议描述长度不能超过 500 个字符'),

  body('scheduledStartTime')
    .optional()
    .isISO8601()
    .withMessage('计划开始时间格式无效'),

  body('scheduledEndTime')
    .optional()
    .isISO8601()
    .withMessage('计划结束时间格式无效')
    .custom((value, { req }) => {
      if (req.body.scheduledStartTime && value && new Date(value) <= new Date(req.body.scheduledStartTime)) {
        throw new Error('计划结束时间必须晚于开始时间')
      }
      return true
    }),

  body('settings.allowRecording')
    .optional()
    .isBoolean()
    .withMessage('允许录制设置必须是布尔值'),

  body('settings.enableTranscription')
    .optional()
    .isBoolean()
    .withMessage('启用转录设置必须是布尔值'),

  body('settings.enableVoiceprint')
    .optional()
    .isBoolean()
    .withMessage('启用声纹识别设置必须是布尔值'),

  body('settings.autoGenerateMinutes')
    .optional()
    .isBoolean()
    .withMessage('自动生成纪要设置必须是布尔值'),

  body('settings.language')
    .optional()
    .isIn(['zh-CN', 'en-US', 'auto'])
    .withMessage('语言设置无效'),
]