import { body } from 'express-validator'

// AI聊天验证
export const validateChatWithAI = [
  body('messages')
    .isArray({ min: 1 })
    .withMessage('消息列表不能为空')
    .custom((messages) => {
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          throw new Error('消息格式无效，必须包含 role 和 content')
        }
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          throw new Error('消息角色必须是 user、assistant 或 system')
        }
      }
      return true
    }),

  body('options.model')
    .optional()
    .isString()
    .withMessage('模型名称必须是字符串'),

  body('options.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('温度参数必须在0-2之间'),

  body('options.maxTokens')
    .optional()
    .isInt({ min: 1, max: 8000 })
    .withMessage('最大token数必须在1-8000之间'),
]

// 生成会议纪要验证
export const validateGenerateMeetingMinutes = [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效'),

  body('options.title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('纪要标题长度不能超过100个字符'),

  body('options.language')
    .optional()
    .isIn(['zh-CN', 'en-US'])
    .withMessage('语言设置无效'),

  body('options.includeActionItems')
    .optional()
    .isBoolean()
    .withMessage('包含行动项设置必须是布尔值'),

  body('options.includeDecisions')
    .optional()
    .isBoolean()
    .withMessage('包含决策设置必须是布尔值'),

  body('options.includeKeyPoints')
    .optional()
    .isBoolean()
    .withMessage('包含关键要点设置必须是布尔值'),

  body('options.customPrompt')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('自定义提示词长度不能超过1000个字符'),
]

// 优化会议纪要验证
export const validateOptimizeMeetingMinutes = [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效'),

  body('feedback')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('反馈内容长度必须在10-1000个字符之间'),

  body('options.title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('纪要标题长度不能超过100个字符'),

  body('options.language')
    .optional()
    .isIn(['zh-CN', 'en-US'])
    .withMessage('语言设置无效'),
]