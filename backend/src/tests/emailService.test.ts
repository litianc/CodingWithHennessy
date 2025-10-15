// @ts-nocheck
import { EmailService } from '@/services/emailService'
import { logger } from '@/utils/logger'

// Mock logger to avoid console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}))

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
    verify: jest.fn()
  }))
}))

describe('EmailService', () => {
  let emailService: EmailService

  beforeEach(() => {
    emailService = new EmailService({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'testpass'
      }
    })

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create an EmailService instance with correct config', () => {
      expect(emailService).toBeInstanceOf(EmailService)
    })
  })

  describe('getDefaultTemplates', () => {
    it('should return an array of email templates', () => {
      const templates = emailService.getDefaultTemplates()

      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)

      // Check that each template has required properties
      templates.forEach(template => {
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('subject')
        expect(template).toHaveProperty('htmlTemplate')
        expect(template).toHaveProperty('variables')
      })
    })

    it('should contain required template types', () => {
      const templates = emailService.getDefaultTemplates()
      const templateIds = templates.map(t => t.id)

      expect(templateIds).toContain('meeting_invitation')
      expect(templateIds).toContain('meeting_minutes')
      expect(templateIds).toContain('meeting_reminder')
    })
  })

  describe('sendMeetingInvitation', () => {
    it('should throw error when template is not found', async () => {
      // Mock the method to return empty templates
      jest.spyOn(emailService, 'getDefaultTemplates').mockReturnValue([])

      const result = await emailService.sendMeetingInvitation(
        'Test Meeting',
        '2024-01-01 10:00',
        'Test Host',
        'Test Description',
        ['test@example.com']
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('会议邀请模板未找到')
    })
  })

  describe('sendMeetingMinutes', () => {
    it('should throw error when template is not found', async () => {
      // Mock the method to return empty templates
      jest.spyOn(emailService, 'getDefaultTemplates').mockReturnValue([])

      const meetingData = {
        title: 'Test Meeting',
        actualStartTime: '2024-01-01 10:00',
        actualEndTime: '2024-01-01 11:00',
        hostName: 'Test Host',
        participants: [],
        minutes: {
          summary: 'Test summary',
          keyPoints: ['Point 1', 'Point 2'],
          actionItems: [],
          decisions: []
        }
      }

      const result = await emailService.sendMeetingMinutes(meetingData, ['test@example.com'])

      expect(result.success).toBe(false)
      expect(result.error).toBe('会议纪要模板未找到')
    })
  })

  describe('sendMeetingReminder', () => {
    it('should throw error when template is not found', async () => {
      // Mock the method to return empty templates
      jest.spyOn(emailService, 'getDefaultTemplates').mockReturnValue([])

      const result = await emailService.sendMeetingReminder(
        'Test Meeting',
        '2024-01-01 10:00',
        'Test Host',
        ['test@example.com']
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('会议提醒模板未找到')
    })
  })

  describe('verifyConnection', () => {
    it('should return true when verification succeeds', async () => {
      const mockVerify = jest.fn().mockResolvedValue(true)
      emailService['transporter'].verify = mockVerify

      const result = await emailService.verifyConnection()

      expect(result).toBe(true)
      expect(mockVerify).toHaveBeenCalled()
    })

    it('should return false when verification fails', async () => {
      const mockVerify = jest.fn().mockRejectedValue(new Error('Connection failed'))
      emailService['transporter'].verify = mockVerify

      const result = await emailService.verifyConnection()

      expect(result).toBe(false)
      expect(mockVerify).toHaveBeenCalled()
    })
  })
})