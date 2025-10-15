import { body } from 'express-validator'

// 用户注册验证
export const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('用户名长度必须在 3-30 个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少 6 个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个小写字母、一个大写字母和一个数字'),

  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('姓名长度必须在 2-50 个字符之间')
    .matches(/^[\u4e00-\u9fa5a-zA-Z\s]+$/)
    .withMessage('姓名只能包含中文、英文和空格'),
]

// 用户登录验证
export const validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('请输入邮箱或用户名'),

  body('password')
    .notEmpty()
    .withMessage('请输入密码'),
]

// 刷新令牌验证
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('刷新令牌不能为空'),
]

// 更新用户信息验证
export const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('姓名长度必须在 2-50 个字符之间')
    .matches(/^[\u4e00-\u9fa5a-zA-Z\s]+$/)
    .withMessage('姓名只能包含中文、英文和空格'),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('头像必须是有效的URL'),

  body('preferences.language')
    .optional()
    .isIn(['zh-CN', 'en-US'])
    .withMessage('语言设置无效'),

  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('主题设置无效'),

  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('通知设置必须是布尔值'),

  body('preferences.autoRecord')
    .optional()
    .isBoolean()
    .withMessage('自动录制设置必须是布尔值'),

  body('settings.voiceprintEnabled')
    .optional()
    .isBoolean()
    .withMessage('声纹识别设置必须是布尔值'),

  body('settings.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('邮件通知设置必须是布尔值'),

  body('settings.transcriptionLanguage')
    .optional()
    .isIn(['zh-CN', 'en-US', 'auto'])
    .withMessage('转录语言设置无效'),

  body('settings.emailSignature')
    .optional()
    .isLength({ max: 500 })
    .withMessage('邮件签名长度不能超过 500 个字符'),
]

// 修改密码验证
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('请输入当前密码'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('新密码长度至少 6 个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('新密码必须包含至少一个小写字母、一个大写字母和一个数字')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('新密码不能与当前密码相同')
      }
      return true
    }),
]