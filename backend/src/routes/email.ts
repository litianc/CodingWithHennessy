// @ts-nocheck
import { Router } from 'express'
import { body } from 'express-validator'
import {
  sendEmail,
  sendTemplateEmail,
  getEmailTemplates,
  sendMeetingInvitation,
  sendMeetingMinutes,
  sendMeetingReminder,
  verifyEmailConfig
} from '@/controllers/emailController'
import { authenticateToken, requireAdmin } from '@/middleware/auth'

const router = Router()

// 所有邮件相关路由都需要认证
router.use(authenticateToken)

// 发送邮件
router.post('/send',
  [
    body('to')
      .isArray({ min: 1 })
      .withMessage('收件人列表不能为空'),
    body('to.*')
      .isEmail()
      .withMessage('请输入有效的邮箱地址'),
    body('subject')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('邮件主题长度必须在1-200个字符之间'),
    body('text')
      .optional()
      .isString()
      .withMessage('邮件正文必须是字符串'),
    body('html')
      .optional()
      .isString()
      .withMessage('HTML内容必须是字符串'),
    body('cc')
      .optional()
      .isArray()
      .withMessage('抄送列表必须是数组'),
    body('cc.*')
      .optional()
      .isEmail()
      .withMessage('请输入有效的抄送邮箱地址'),
    body('bcc')
      .optional()
      .isArray()
      .withMessage('密送列表必须是数组'),
    body('bcc.*')
      .optional()
      .isEmail()
      .withMessage('请输入有效的密送邮箱地址'),
    body('attachments')
      .optional()
      .isArray()
      .withMessage('附件列表必须是数组')
  ],
  sendEmail
)

// 使用模板发送邮件
router.post('/send-template',
  [
    body('templateId')
      .isIn(['meeting_invitation', 'meeting_minutes', 'meeting_reminder'])
      .withMessage('无效的邮件模板ID'),
    body('variables')
      .isObject()
      .withMessage('模板变量必须是对象'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('收件人列表不能为空'),
    body('recipients.*')
      .isEmail()
      .withMessage('请输入有效的邮箱地址'),
    body('options')
      .optional()
      .isObject()
      .withMessage('邮件选项必须是对象')
  ],
  sendTemplateEmail
)

// 获取邮件模板列表
router.get('/templates', getEmailTemplates)

// 发送会议邀请邮件
router.post('/meeting/invitation',
  [
    body('meetingId')
      .isMongoId()
      .withMessage('会议ID格式无效'),
    body('customRecipients')
      .optional()
      .isArray()
      .withMessage('自定义收件人列表必须是数组'),
    body('customRecipients.*')
      .optional()
      .isEmail()
      .withMessage('请输入有效的自定义收件人邮箱地址')
  ],
  sendMeetingInvitation
)

// 发送会议纪要邮件
router.post('/meeting/minutes',
  [
    body('meetingId')
      .isMongoId()
      .withMessage('会议ID格式无效'),
    body('customRecipients')
      .optional()
      .isArray()
      .withMessage('自定义收件人列表必须是数组'),
    body('customRecipients.*')
      .optional()
      .isEmail()
      .withMessage('请输入有效的自定义收件人邮箱地址')
  ],
  sendMeetingMinutes
)

// 发送会议提醒邮件
router.post('/meeting/reminder',
  [
    body('meetingId')
      .isMongoId()
      .withMessage('会议ID格式无效'),
    body('customRecipients')
      .optional()
      .isArray()
      .withMessage('自定义收件人列表必须是数组'),
    body('customRecipients.*')
      .optional()
      .isEmail()
      .withMessage('请输入有效的自定义收件人邮箱地址')
  ],
  sendMeetingReminder
)

// 验证邮箱配置 (仅管理员)
router.get('/verify', requireAdmin, verifyEmailConfig)

export default router