// @ts-nocheck
import nodemailer from 'nodemailer'
import { logger } from '@/utils/logger'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlTemplate: string
  variables: string[]
  description?: string
}

export class EmailService {
  private transporter: nodemailer.Transporter
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }

  /**
   * 发送邮件
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const mailOptions = {
        from: `${this.config.auth.user}`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      }

      const result = await this.transporter.sendMail(mailOptions)

      logger.info(`邮件发送成功: ${result.messageId} -> ${options.to}`)

      return {
        success: true,
        messageId: result.messageId
      }
    } catch (error) {
      logger.error('邮件发送失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '邮件发送失败'
      }
    }
  }

  /**
   * 使用模板发送邮件
   */
  async sendTemplateEmail(
    template: EmailTemplate,
    variables: Record<string, any>,
    recipients: string | string[],
    options?: Partial<EmailOptions>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // 替换模板变量
      let html = template.htmlTemplate
      let subject = template.subject

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        html = html.replace(regex, String(value))
        subject = subject.replace(regex, String(value))
      }

      const emailOptions: EmailOptions = {
        to: recipients,
        subject,
        html,
        ...options
      }

      return await this.sendEmail(emailOptions)
    } catch (error) {
      logger.error('模板邮件发送失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '模板邮件发送失败'
      }
    }
  }

  /**
   * 验证邮箱配置
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      logger.info('邮箱服务连接验证成功')
      return true
    } catch (error) {
      logger.error('邮箱服务连接验证失败:', error)
      return false
    }
  }

  /**
   * 获取默认邮件模板
   */
  getDefaultTemplates(): EmailTemplate[] {
    return [
      {
        id: 'meeting_invitation',
        name: '会议邀请',
        subject: '会议邀请 - {{meetingTitle}}',
        htmlTemplate: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>会议邀请</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4A90E2; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .meeting-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>会议邀请</h1>
            </div>
            <div class="content">
              <p>您好，</p>
              <p>您被邀请参加以下会议：</p>
              <div class="meeting-info">
                <h3>{{meetingTitle}}</h3>
                <p><strong>时间：</strong>{{scheduledStartTime}}</p>
                <p><strong>主持人：</strong>{{hostName}}</p>
                {{#if description}}
                <p><strong>描述：</strong>{{description}}</p>
                {{/if}}
              </div>
              <p>请准时参加会议。</p>
            </div>
            <div class="footer">
              <p>此邮件由智能会议纪要系统自动发送</p>
            </div>
          </body>
          </html>
        `,
        variables: ['meetingTitle', 'scheduledStartTime', 'hostName', 'description'],
        description: '发送会议邀请邮件'
      },
      {
        id: 'meeting_minutes',
        name: '会议纪要',
        subject: '会议纪要 - {{meetingTitle}}',
        htmlTemplate: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>会议纪要</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { background: #4A90E2; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .section { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .section h3 { color: #4A90E2; margin-top: 0; }
              .action-item { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
              .decision { background: #d1ecf1; padding: 10px; margin: 5px 0; border-left: 4px solid #17a2b8; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>会议纪要</h1>
            </div>
            <div class="content">
              <div class="section">
                <h3>会议信息</h3>
                <p><strong>标题：</strong>{{meetingTitle}}</p>
                <p><strong>时间：</strong>{{actualStartTime}} - {{actualEndTime}}</p>
                <p><strong>主持人：</strong>{{hostName}}</p>
                <p><strong>参与者：</strong>{{participants}}</p>
              </div>

              <div class="section">
                <h3>会议摘要</h3>
                <p>{{summary}}</p>
              </div>

              <div class="section">
                <h3>关键要点</h3>
                <ul>
                  {{#each keyPoints}}
                  <li>{{this}}</li>
                  {{/each}}
                </ul>
              </div>

              {{#if actionItems}}
              <div class="section">
                <h3>行动项目</h3>
                {{#each actionItems}}
                <div class="action-item">
                  <strong>{{description}}</strong><br>
                  <small>负责人：{{assignee}} | 截止时间：{{dueDate}}</small>
                </div>
                {{/each}}
              </div>
              {{/if}}

              {{#if decisions}}
              <div class="section">
                <h3>决策事项</h3>
                {{#each decisions}}
                <div class="decision">
                  <strong>{{description}}</strong><br>
                  <small>决策者：{{decisionMaker}} | 时间：{{timestamp}}</small>
                </div>
                {{/each}}
              </div>
              {{/if}}
            </div>
            <div class="footer">
              <p>此邮件由智能会议纪要系统自动发送</p>
            </div>
          </body>
          </html>
        `,
        variables: ['meetingTitle', 'actualStartTime', 'actualEndTime', 'hostName', 'participants', 'summary', 'keyPoints', 'actionItems', 'decisions'],
        description: '发送会议纪要邮件'
      },
      {
        id: 'meeting_reminder',
        name: '会议提醒',
        subject: '会议提醒 - {{meetingTitle}}',
        htmlTemplate: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>会议提醒</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #28a745; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .reminder { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>会议提醒</h1>
            </div>
            <div class="content">
              <p>您好，</p>
              <div class="reminder">
                <h3>即将开始</h3>
                <p><strong>会议：</strong>{{meetingTitle}}</p>
                <p><strong>时间：</strong>{{scheduledStartTime}}</p>
                <p><strong>主持人：</strong>{{hostName}}</p>
              </div>
              <p>请准备好参加会议。</p>
            </div>
            <div class="footer">
              <p>此邮件由智能会议纪要系统自动发送</p>
            </div>
          </body>
          </html>
        `,
        variables: ['meetingTitle', 'scheduledStartTime', 'hostName'],
        description: '发送会议提醒邮件'
      }
    ]
  }

  /**
   * 发送会议邀请邮件
   */
  async sendMeetingInvitation(
    meetingTitle: string,
    scheduledStartTime: string,
    hostName: string,
    description?: string,
    recipients: string | string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.getDefaultTemplates().find(t => t.id === 'meeting_invitation')
    if (!template) {
      return { success: false, error: '会议邀请模板未找到' }
    }

    const variables = {
      meetingTitle,
      scheduledStartTime,
      hostName,
      description: description || ''
    }

    return await this.sendTemplateEmail(template, variables, recipients)
  }

  /**
   * 发送会议纪要邮件
   */
  async sendMeetingMinutes(
    meetingData: any,
    recipients: string | string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.getDefaultTemplates().find(t => t.id === 'meeting_minutes')
    if (!template) {
      return { success: false, error: '会议纪要模板未找到' }
    }

    const variables = {
      meetingTitle: meetingData.title,
      actualStartTime: meetingData.actualStartTime,
      actualEndTime: meetingData.actualEndTime,
      hostName: meetingData.hostName,
      participants: meetingData.participants?.map((p: any) => p.name).join(', ') || '',
      summary: meetingData.minutes?.summary || '',
      keyPoints: meetingData.minutes?.keyPoints || [],
      actionItems: meetingData.minutes?.actionItems || [],
      decisions: meetingData.minutes?.decisions || []
    }

    return await this.sendTemplateEmail(template, variables, recipients)
  }

  /**
   * 发送会议提醒邮件
   */
  async sendMeetingReminder(
    meetingTitle: string,
    scheduledStartTime: string,
    hostName: string,
    recipients: string | string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.getDefaultTemplates().find(t => t.id === 'meeting_reminder')
    if (!template) {
      return { success: false, error: '会议提醒模板未找到' }
    }

    const variables = {
      meetingTitle,
      scheduledStartTime,
      hostName
    }

    return await this.sendTemplateEmail(template, variables, recipients)
  }
}

// 创建邮件服务实例
export const emailService = new EmailService({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
})