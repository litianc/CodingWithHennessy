import { DeepSeekAIService } from '@/services/aiService'
import axios from 'axios'

// Mock logger to avoid actual logging during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  },
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logHttp: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  }
}))

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('DeepSeekAIService', () => {
  let aiService: DeepSeekAIService

  beforeEach(() => {
    // Set environment variables for testing
    process.env.DEEPSEEK_API_KEY = 'test-api-key'
    process.env.DEEPSEEK_API_BASE_URL = 'https://api.test.deepseek.com'

    aiService = new DeepSeekAIService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_BASE_URL
  })

  describe('constructor', () => {
    it('should create DeepSeekAIService instance with default values', () => {
      expect(aiService).toBeInstanceOf(DeepSeekAIService)
    })

    it('should use environment variables for configuration', () => {
      process.env.DEEPSEEK_API_KEY = 'custom-key'
      process.env.DEEPSEEK_API_BASE_URL = 'https://custom.api.com'

      const customService = new DeepSeekAIService()
      expect(customService).toBeInstanceOf(DeepSeekAIService)

      delete process.env.DEEPSEEK_API_KEY
      delete process.env.DEEPSEEK_API_BASE_URL
    })
  })

  describe('chatCompletion', () => {
    const mockResponse = {
      data: {
        id: 'chat-test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finishReason: 'stop'
          }
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      }
    }

    it('should make successful chat completion request', async () => {
      mockedAxios.post.mockResolvedValue(mockResponse)

      const messages = [
        { role: 'user' as const, content: 'Hello, how are you?' }
      ]

      const response = await aiService.chatCompletion(messages)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.test.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: false
        },
        {
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      expect(response).toEqual(mockResponse.data)
    })

    it('should use custom options', async () => {
      mockedAxios.post.mockResolvedValue(mockResponse)

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ]

      const options = {
        model: 'custom-model',
        temperature: 0.5,
        maxTokens: 1000,
        topP: 0.8,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        stream: true
      }

      await aiService.chatCompletion(messages, options)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'custom-model',
          temperature: 0.5,
          max_tokens: 1000,
          top_p: 0.8,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          stream: true
        }),
        expect.any(Object)
      )
    })

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: 'Invalid API key'
            }
          }
        }
      }

      mockedAxios.post.mockRejectedValue(mockError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ]

      await expect(aiService.chatCompletion(messages)).rejects.toThrow('DeepSeek API 错误: Invalid API key')
    })

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error')
      mockedAxios.post.mockRejectedValue(networkError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ]

      await expect(aiService.chatCompletion(messages)).rejects.toThrow('AI 服务调用失败')
    })
  })

  describe('generateMeetingMinutes', () => {
    const mockChatResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '产品开发会议',
                summary: '讨论了新产品功能的开发计划和时间安排',
                keyPoints: [
                  '确定了核心功能需求',
                  '制定了开发时间表',
                  '分配了团队责任'
                ],
                actionItems: [
                  {
                    description: '完成需求文档',
                    assignee: '张三',
                    priority: 'high'
                  }
                ],
                decisions: [
                  {
                    description: '采用敏捷开发模式',
                    decisionMaker: '项目经理',
                    context: '为了提高开发效率'
                  }
                ],
                nextSteps: [
                  '开始原型设计',
                  '进行技术选型'
                ]
              })
            }
          }
        ]
      }
    }

    it('should generate meeting minutes successfully', async () => {
      mockedAxios.post.mockResolvedValue(mockChatResponse)

      const transcriptionText = '今天我们讨论了新产品的开发计划...'
      const result = await aiService.generateMeetingMinutes(transcriptionText)

      expect(result.title).toBe('产品开发会议')
      expect(result.summary).toContain('开发计划')
      expect(result.keyPoints).toHaveLength(3)
      expect(result.actionItems).toHaveLength(1)
      expect(result.decisions).toHaveLength(1)
      expect(result.nextSteps).toHaveLength(2)
    })

    it('should use custom options', async () => {
      mockedAxios.post.mockResolvedValue(mockChatResponse)

      const transcriptionText = 'Meeting content...'
      const options = {
        title: 'Custom Meeting Title',
        language: 'en-US',
        includeActionItems: false,
        includeDecisions: false,
        includeKeyPoints: false,
        customPrompt: 'Additional instructions'
      }

      await aiService.generateMeetingMinutes(transcriptionText, options)

      expect(mockedAxios.post).toHaveBeenCalled()

      // Check that the system prompt includes custom instructions
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as any
      const systemMessage = requestBody.messages.find((m: any) => m.role === 'system')
      expect(systemMessage.content).toContain('Additional instructions')
    })

    it('should handle API errors in meeting minutes generation', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'))

      const transcriptionText = 'Meeting content...'

      await expect(aiService.generateMeetingMinutes(transcriptionText)).rejects.toThrow('生成会议纪要失败')
    })

    it('should handle malformed JSON response', async () => {
      const malformedResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'This is not valid JSON content'
              }
            }
          ]
        }
      }

      mockedAxios.post.mockResolvedValue(malformedResponse)

      const transcriptionText = 'Meeting content...'
      const result = await aiService.generateMeetingMinutes(transcriptionText)

      expect(result.title).toBe('会议纪要')
      expect(result.summary).toBe('This is not valid JSON content')
      expect(result.keyPoints).toEqual([])
      expect(result.actionItems).toEqual([])
      expect(result.decisions).toEqual([])
      expect(result.nextSteps).toEqual([])
    })
  })

  describe('optimizeMeetingMinutes', () => {
    const mockOptimizeResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '优化后的会议纪要',
                summary: '经过优化的会议摘要',
                keyPoints: ['优化后的要点1', '优化后的要点2'],
                actionItems: [
                  {
                    description: '优化后的行动项',
                    assignee: '负责人',
                    priority: 'medium'
                  }
                ],
                decisions: [],
                nextSteps: ['优化后的下一步']
              })
            }
          }
        ]
      }
    }

    it('should optimize meeting minutes successfully', async () => {
      mockedAxios.post.mockResolvedValue(mockOptimizeResponse)

      const currentMinutes = 'Current meeting minutes content...'
      const feedback = 'Please add more details about action items'
      const result = await aiService.optimizeMeetingMinutes(currentMinutes, feedback)

      expect(result.title).toBe('优化后的会议纪要')
      expect(result.summary).toContain('优化的会议摘要')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Verify the prompt includes current minutes and feedback
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as any
      const userMessage = requestBody.messages.find((m: any) => m.role === 'user')
      expect(userMessage.content).toContain(currentMinutes)
      expect(userMessage.content).toContain(feedback)
    })

    it('should handle optimization errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Optimization failed'))

      const currentMinutes = 'Current minutes...'
      const feedback = 'Add more details'

      await expect(aiService.optimizeMeetingMinutes(currentMinutes, feedback)).rejects.toThrow('优化会议纪要失败')
    })
  })

  describe('checkAvailability', () => {
    it('should return true when API is available', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Hello!'
              }
            }
          ]
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const isAvailable = await aiService.checkAvailability()
      expect(isAvailable).toBe(true)
    })

    it('should return false when API is unavailable', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API unavailable'))

      const isAvailable = await aiService.checkAvailability()
      expect(isAvailable).toBe(false)
    })

    it('should return false when response has no content', async () => {
      const mockResponse = {
        data: {
          choices: []
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const isAvailable = await aiService.checkAvailability()
      expect(isAvailable).toBe(false)
    })
  })

  describe('parseMeetingMinutesResult', () => {
    // This is a private method, but we can test it indirectly through the public methods
    it('should parse valid JSON correctly', async () => {
      const validJsonContent = `
        Some text before JSON
        {
          "title": "Test Meeting",
          "summary": "Test summary",
          "keyPoints": ["Point 1", "Point 2"],
          "actionItems": [
            {
              "description": "Test action",
              "assignee": "John",
              "priority": "high"
            }
          ],
          "decisions": [],
          "nextSteps": ["Step 1"]
        }
        Some text after JSON
      `

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: validJsonContent
              }
            }
          ]
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await aiService.generateMeetingMinutes('Test transcription')
      expect(result.title).toBe('Test Meeting')
      expect(result.summary).toBe('Test summary')
      expect(result.keyPoints).toEqual(['Point 1', 'Point 2'])
      expect(result.actionItems).toHaveLength(1)
      expect(result.actionItems[0].description).toBe('Test action')
      expect(result.nextSteps).toEqual(['Step 1'])
    })

    it('should handle completely invalid JSON', async () => {
      const invalidJsonContent = 'This is not JSON at all'

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: invalidJsonContent
              }
            }
          ]
        }
      }

      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await aiService.generateMeetingMinutes('Test transcription', { title: 'Custom Title' })
      expect(result.title).toBe('Custom Title')
      expect(result.summary).toBe(invalidJsonContent)
      expect(result.keyPoints).toEqual([])
      expect(result.actionItems).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded')
      mockedAxios.post.mockRejectedValue(timeoutError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ]

      await expect(aiService.chatCompletion(messages)).rejects.toThrow('AI 服务调用失败')
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        response: {
          data: {
            error: {
              message: 'Rate limit exceeded'
            }
          }
        }
      }

      mockedAxios.post.mockRejectedValue(rateLimitError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ]

      await expect(aiService.chatCompletion(messages)).rejects.toThrow('DeepSeek API 错误: Rate limit exceeded')
    })
  })
})