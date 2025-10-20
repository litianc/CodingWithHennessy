/**
 * 原生SMTP邮件服务
 * 使用Node.js原生tls模块实现，避免nodemailer的TLS握手问题
 */

import * as tls from 'tls'
import { logger } from '@/utils/logger'

export interface NativeEmailConfig {
  host: string
  port: number
  user: string
  pass: string
}

export interface NativeEmailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html?: string
  text?: string
}

export class NativeEmailService {
  private config: NativeEmailConfig

  constructor(config: NativeEmailConfig) {
    this.config = config
  }

  /**
   * Base64编码
   */
  private base64Encode(str: string): string {
    return Buffer.from(str).toString('base64')
  }

  /**
   * 发送SMTP命令并等待响应
   */
  private sendCommand(socket: tls.TLSSocket, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let responseData = ''

      const dataHandler = (data: Buffer) => {
        responseData += data.toString()

        // 检查是否是完整的响应（以\r\n结尾）
        if (responseData.endsWith('\r\n')) {
          socket.off('data', dataHandler)
          resolve(responseData.trim())
        }
      }

      socket.on('data', dataHandler)
      socket.write(command + '\r\n')

      // 10秒超时
      setTimeout(() => {
        socket.off('data', dataHandler)
        reject(new Error('Command timeout'))
      }, 10000)
    })
  }

  /**
   * 发送邮件
   */
  async sendEmail(options: NativeEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return new Promise((resolve) => {
      const socket = tls.connect({
        host: this.config.host,
        port: this.config.port,
        rejectUnauthorized: false
      }, async () => {
        try {
          logger.info('SSL连接成功')

          // 读取欢迎消息
          const welcome = await new Promise<string>((res) => {
            socket.once('data', (data) => res(data.toString().trim()))
          })
          logger.debug(`服务器欢迎: ${welcome}`)

          if (!welcome.startsWith('220')) {
            throw new Error(`非法的欢迎消息: ${welcome}`)
          }

          // EHLO
          const ehlo = await this.sendCommand(socket, 'EHLO localhost')
          logger.debug(`EHLO响应: ${ehlo}`)

          // AUTH LOGIN
          const authLogin = await this.sendCommand(socket, 'AUTH LOGIN')
          logger.debug(`AUTH LOGIN响应: ${authLogin}`)

          // 发送用户名
          const usernameResp = await this.sendCommand(socket, this.base64Encode(this.config.user))
          logger.debug(`用户名响应: ${usernameResp}`)

          // 发送密码
          const passwordResp = await this.sendCommand(socket, this.base64Encode(this.config.pass))
          logger.debug(`密码响应: ${passwordResp}`)

          if (!passwordResp.startsWith('235')) {
            throw new Error(`认证失败: ${passwordResp}`)
          }

          logger.info('SMTP认证成功')

          // MAIL FROM
          const mailFrom = await this.sendCommand(socket, `MAIL FROM:<${this.config.user}>`)
          if (!mailFrom.startsWith('250')) {
            throw new Error(`MAIL FROM失败: ${mailFrom}`)
          }

          // RCPT TO (处理多个收件人)
          const recipients = Array.isArray(options.to) ? options.to : [options.to]
          for (const recipient of recipients) {
            const rcptTo = await this.sendCommand(socket, `RCPT TO:<${recipient}>`)
            if (!rcptTo.startsWith('250')) {
              throw new Error(`RCPT TO失败: ${rcptTo}`)
            }
          }

          // DATA
          const dataCmd = await this.sendCommand(socket, 'DATA')
          if (!dataCmd.startsWith('354')) {
            throw new Error(`DATA命令失败: ${dataCmd}`)
          }

          // 构建邮件内容
          const emailDate = new Date().toUTCString()
          const messageId = `<${Date.now()}.${Math.random().toString(36)}@${this.config.host}>`

          let emailContent = [
            `From: "智能会议纪要系统" <${this.config.user}>`,
            `To: ${recipients.join(', ')}`,
          ]

          // 添加抄送
          if (options.cc) {
            const ccList = Array.isArray(options.cc) ? options.cc : [options.cc]
            emailContent.push(`Cc: ${ccList.join(', ')}`)
          }

          emailContent.push(
            `Subject: =?UTF-8?B?${this.base64Encode(options.subject)}?=`,
            `Date: ${emailDate}`,
            `Message-ID: ${messageId}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            options.html || options.text || '',
            '.',
            ''
          )

          // 发送邮件内容
          const sendResult = await this.sendCommand(socket, emailContent.join('\r\n'))
          if (!sendResult.startsWith('250')) {
            throw new Error(`邮件发送失败: ${sendResult}`)
          }

          logger.info(`邮件发送成功: ${messageId}`)

          // QUIT
          await this.sendCommand(socket, 'QUIT')
          socket.end()

          resolve({
            success: true,
            messageId
          })
        } catch (error) {
          socket.end()
          logger.error('邮件发送失败:', error)
          resolve({
            success: false,
            error: error instanceof Error ? error.message : '邮件发送失败'
          })
        }
      })

      socket.on('error', (err) => {
        logger.error('Socket错误:', err)
        resolve({
          success: false,
          error: err.message
        })
      })

      socket.setTimeout(30000, () => {
        socket.destroy()
        resolve({
          success: false,
          error: '连接超时'
        })
      })
    })
  }

  /**
   * 发送会议纪要邮件
   */
  async sendMeetingMinutes(
    meetingData: any,
    recipients: string | string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = `会议纪要 - ${meetingData.title}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="800" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">会议纪要</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                      <h3 style="color: #333; margin-top: 0;">会议信息</h3>
                      <p><strong>标题：</strong>${meetingData.title}</p>
                      <p><strong>时间：</strong>${meetingData.actualStartTime || ''} - ${meetingData.actualEndTime || ''}</p>
                      <p><strong>主持人：</strong>${meetingData.hostName || '未知'}</p>
                      ${meetingData.participants ? `<p><strong>参与者：</strong>${meetingData.participants.map((p: any) => p.name).join(', ')}</p>` : ''}
                    </div>

                    ${meetingData.minutes?.summary ? `
                    <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin-bottom: 20px;">
                      <h3 style="color: #333; margin-top: 0;">会议摘要</h3>
                      <p style="line-height: 1.6;">${meetingData.minutes.summary}</p>
                    </div>
                    ` : ''}

                    ${meetingData.minutes?.keyPoints && meetingData.minutes.keyPoints.length > 0 ? `
                    <div style="background: white; padding: 20px; margin-bottom: 20px;">
                      <h3 style="color: #333; margin-top: 0;">关键要点</h3>
                      <ul>
                        ${meetingData.minutes.keyPoints.map((point: string) => `<li>${point}</li>`).join('')}
                      </ul>
                    </div>
                    ` : ''}

                    ${meetingData.minutes?.actionItems && meetingData.minutes.actionItems.length > 0 ? `
                    <div style="background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                      <h3 style="color: #333; margin-top: 0;">行动项目</h3>
                      ${meetingData.minutes.actionItems.map((item: any) => `
                        <div style="margin-bottom: 10px;">
                          <strong>${item.description || item}</strong><br>
                          ${item.assignee ? `<small>负责人：${item.assignee}</small>` : ''}
                          ${item.dueDate ? `<small> | 截止时间：${item.dueDate}</small>` : ''}
                        </div>
                      `).join('')}
                    </div>
                    ` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; border-top: 1px solid #e8e8e8; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      此邮件由智能会议纪要系统自动发送<br>
                      时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: recipients,
      subject,
      html
    })
  }

  /**
   * 发送会议邀请邮件
   */
  async sendMeetingInvitation(
    meetingTitle: string,
    scheduledStartTime: string,
    hostName: string,
    description: string,
    recipients: string | string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = `会议邀请 - ${meetingTitle}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">会议邀请</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <p style="color: #333; font-size: 16px;">您好，</p>
                    <p style="color: #666; line-height: 1.6;">您被邀请参加以下会议：</p>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                      <h3 style="color: #333; margin-top: 0;">${meetingTitle}</h3>
                      <p><strong>时间：</strong>${scheduledStartTime}</p>
                      <p><strong>主持人：</strong>${hostName}</p>
                      ${description ? `<p><strong>描述：</strong>${description}</p>` : ''}
                    </div>

                    <p style="color: #666; line-height: 1.6;">请准时参加会议。</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; border-top: 1px solid #e8e8e8; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      此邮件由智能会议纪要系统自动发送<br>
                      时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: recipients,
      subject,
      html
    })
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
    const subject = `会议提醒 - ${meetingTitle}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #28a745 0%, #20803a 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">会议提醒</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <p style="color: #333; font-size: 16px;">您好，</p>

                    <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                      <h3 style="color: #333; margin-top: 0;">会议即将开始</h3>
                      <p><strong>会议：</strong>${meetingTitle}</p>
                      <p><strong>时间：</strong>${scheduledStartTime}</p>
                      <p><strong>主持人：</strong>${hostName}</p>
                    </div>

                    <p style="color: #666; line-height: 1.6;">请准备好参加会议。</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px; border-top: 1px solid #e8e8e8; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      此邮件由智能会议纪要系统自动发送<br>
                      时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: recipients,
      subject,
      html
    })
  }
}

// 创建原生邮件服务实例
export const nativeEmailService = new NativeEmailService({
  host: process.env.SMTP_HOST || 'smtp.163.com',
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || ''
})
