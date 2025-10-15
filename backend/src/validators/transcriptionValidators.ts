import { body } from 'express-validator'

// 从文件转录验证
export const validateTranscribeFromFile = [
  body('meetingId')
    .notEmpty()
    .withMessage('会议ID不能为空')
    .isMongoId()
    .withMessage('会议ID格式无效'),

  body('options.language')
    .optional()
    .isIn(['zh-CN', 'en-US', 'auto'])
    .withMessage('语言设置无效'),

  body('options.enablePunctuation')
    .optional()
    .isBoolean()
    .withMessage('启用标点符号设置必须是布尔值'),

  body('options.enableSpeakerDiarization')
    .optional()
    .isBoolean()
    .withMessage('启用说话人分离设置必须是布尔值'),

  body('options.speakerCount')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('说话人数量必须在1-10之间'),
]

// 更新转录记录验证
export const validateUpdateTranscription = [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('转录内容长度必须在1-2000个字符之间'),

  body('speakerName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('说话人姓名长度必须在1-50个字符之间'),
]

// 更新说话人信息验证
export const validateUpdateSpeakerInfo = [
  body('speakerId')
    .notEmpty()
    .withMessage('说话人ID不能为空'),

  body('speakerName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('说话人姓名长度必须在1-50个字符之间'),
]