// @ts-nocheck
import { Response } from 'express'
import { validationResult } from 'express-validator'
import { emailService } from '@/services/emailService'
import { nativeEmailService } from '@/services/nativeEmailService'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { logger } from '@/utils/logger'
import { Meeting } from '@/models/Meeting'

// 发送邮件
export const sendEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { to, cc, bcc, subject, text, html, attachments } = req.body
  const userId = req.user!._id

  try {
    const result = await emailService.sendEmail({
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments
    })

    if (result.success) {
      logger.info(`邮件发送成功: ${result.messageId} by user ${userId}`)
      res.json({
        success: true,
        message: '邮件发送成功',
        data: { messageId: result.messageId }
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || '邮件发送失败'
      })
    }
  } catch (error) {
    logger.error('邮件发送失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '邮件发送失败'
    })
  }
})

// 使用模板发送邮件
export const sendTemplateEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { templateId, variables, recipients, options } = req.body
  const userId = req.user!._id

  try {
    // 获取模板
    const templates = emailService.getDefaultTemplates()
    const template = templates.find(t => t.id === templateId)

    if (!template) {
      res.status(404).json({
        success: false,
        message: '邮件模板未找到'
      })
      return
    }

    const result = await emailService.sendTemplateEmail(template, variables, recipients, options)

    if (result.success) {
      logger.info(`模板邮件发送成功: ${result.messageId} by user ${userId}`)
      res.json({
        success: true,
        message: '模板邮件发送成功',
        data: { messageId: result.messageId }
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || '模板邮件发送失败'
      })
    }
  } catch (error) {
    logger.error('模板邮件发送失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '模板邮件发送失败'
    })
  }
})

// 获取邮件模板列表
export const getEmailTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const templates = emailService.getDefaultTemplates()

    res.json({
      success: true,
      data: { templates }
    })
  } catch (error) {
    logger.error('获取邮件模板失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取邮件模板失败'
    })
  }
})

// 发送会议邀请邮件
export const sendMeetingInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId, customRecipients } = req.body
  const userId = req.user!._id

  try {
    // 获取会议信息
    const meeting = await Meeting.findById(meetingId).populate('host', 'username name email')

    if (!meeting) {
      res.status(404).json({
        success: false,
        message: '会议不存在'
      })
      return
    }

    // Demo模式：放宽权限检查
    const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true' || userId.toString() === 'demo-user-id'

    // 检查权限
    if (!isDemoMode && !meeting.isHost(userId.toString()) && req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有主持人或管理员可以发送会议邀请'
      })
      return
    }

    // 准备收件人列表
    let recipients: string[] = []

    // 添加会议参与者
    if (meeting.participants && meeting.participants.length > 0) {
      recipients.push(...meeting.participants.map((p: any) => p.email))
    }

    // 添加自定义收件人
    if (customRecipients && Array.isArray(customRecipients)) {
      recipients.push(...customRecipients)
    }

    // 去重
    recipients = [...new Set(recipients)]

    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        message: '没有有效的收件人'
      })
      return
    }

    // 发送邮件 - 使用原生邮件服务
    const result = await nativeEmailService.sendMeetingInvitation(
      meeting.title,
      meeting.scheduledStartTime?.toLocaleString('zh-CN') || '',
      meeting.host?.name || '未知',
      meeting.description || '',
      recipients
    )

    if (result.success) {
      logger.info(`会议邀请邮件发送成功: ${result.messageId} for meeting ${meetingId} by user ${userId}`)
      res.json({
        success: true,
        message: '会议邀请邮件发送成功',
        data: {
          messageId: result.messageId,
          recipients: recipients.length
        }
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || '会议邀请邮件发送失败'
      })
    }
  } catch (error) {
    logger.error('发送会议邀请邮件失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '发送会议邀请邮件失败'
    })
  }
})

// 发送会议纪要邮件
export const sendMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId, customRecipients } = req.body
  const userId = req.user!._id

  try {
    // 获取会议信息
    const meeting = await Meeting.findById(meetingId).populate('host', 'username name email')

    if (!meeting) {
      res.status(404).json({
        success: false,
        message: '会议不存在'
      })
      return
    }

    // Demo模式：放宽权限检查
    const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true' || userId.toString() === 'demo-user-id'

    // 检查权限
    if (!isDemoMode && !meeting.isHost(userId.toString()) && req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有主持人或管理员可以发送会议纪要'
      })
      return
    }

    // 检查会议是否有纪要
    if (!meeting.minutes) {
      res.status(400).json({
        success: false,
        message: '会议纪要尚未生成'
      })
      return
    }

    // 准备收件人列表
    let recipients: string[] = []

    // 添加会议参与者
    if (meeting.participants && meeting.participants.length > 0) {
      recipients.push(...meeting.participants.map((p: any) => p.email))
    }

    // 添加自定义收件人
    if (customRecipients && Array.isArray(customRecipients)) {
      recipients.push(...customRecipients)
    }

    // 去重
    recipients = [...new Set(recipients)]

    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        message: '没有有效的收件人'
      })
      return
    }

    // 准备会议数据
    const meetingData = {
      title: meeting.title,
      actualStartTime: meeting.actualStartTime?.toLocaleString('zh-CN') || '',
      actualEndTime: meeting.actualEndTime?.toLocaleString('zh-CN') || '',
      hostName: meeting.host?.name || '未知',
      participants: meeting.participants,
      minutes: meeting.minutes
    }

    // 发送邮件 - 使用原生邮件服务避免nodemailer TLS问题
    const result = await nativeEmailService.sendMeetingMinutes(meetingData, recipients)

    if (result.success) {
      logger.info(`会议纪要邮件发送成功: ${result.messageId} for meeting ${meetingId} by user ${userId}`)
      res.json({
        success: true,
        message: '会议纪要邮件发送成功',
        data: {
          messageId: result.messageId,
          recipients: recipients.length
        }
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || '会议纪要邮件发送失败'
      })
    }
  } catch (error) {
    logger.error('发送会议纪要邮件失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '发送会议纪要邮件失败'
    })
  }
})

// 发送会议提醒邮件
export const sendMeetingReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 验证输入
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array()
    })
    return
  }

  const { meetingId, customRecipients } = req.body
  const userId = req.user!._id

  try {
    // 获取会议信息
    const meeting = await Meeting.findById(meetingId).populate('host', 'username name email')

    if (!meeting) {
      res.status(404).json({
        success: false,
        message: '会议不存在'
      })
      return
    }

    // Demo模式：放宽权限检查
    const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true' || userId.toString() === 'demo-user-id'

    // 检查权限
    if (!isDemoMode && !meeting.isHost(userId.toString()) && req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有主持人或管理员可以发送会议提醒'
      })
      return
    }

    // 检查会议状态
    if (meeting.status !== 'scheduled') {
      res.status(400).json({
        success: false,
        message: '只能为已安排的会议发送提醒'
      })
      return
    }

    // 准备收件人列表
    let recipients: string[] = []

    // 添加会议参与者
    if (meeting.participants && meeting.participants.length > 0) {
      recipients.push(...meeting.participants.map((p: any) => p.email))
    }

    // 添加自定义收件人
    if (customRecipients && Array.isArray(customRecipients)) {
      recipients.push(...customRecipients)
    }

    // 去重
    recipients = [...new Set(recipients)]

    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        message: '没有有效的收件人'
      })
      return
    }

    // 发送邮件 - 使用原生邮件服务
    const result = await nativeEmailService.sendMeetingReminder(
      meeting.title,
      meeting.scheduledStartTime?.toLocaleString('zh-CN') || '',
      meeting.host?.name || '未知',
      recipients
    )

    if (result.success) {
      logger.info(`会议提醒邮件发送成功: ${result.messageId} for meeting ${meetingId} by user ${userId}`)
      res.json({
        success: true,
        message: '会议提醒邮件发送成功',
        data: {
          messageId: result.messageId,
          recipients: recipients.length
        }
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || '会议提醒邮件发送失败'
      })
    }
  } catch (error) {
    logger.error('发送会议提醒邮件失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '发送会议提醒邮件失败'
    })
  }
})

// 验证邮箱配置
export const verifyEmailConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // 检查权限
  if (req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: '只有管理员可以验证邮箱配置'
    })
    return
  }

  try {
    const isValid = await emailService.verifyConnection()

    res.json({
      success: true,
      data: {
        isValid,
        message: isValid ? '邮箱配置验证成功' : '邮箱配置验证失败'
      }
    })
  } catch (error) {
    logger.error('验证邮箱配置失败:', error)
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '验证邮箱配置失败'
    })
  }
})