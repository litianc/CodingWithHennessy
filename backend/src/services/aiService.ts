// @ts-nocheck
import axios from 'axios'
import { logger } from '@/utils/logger'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finishReason: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface MeetingMinutesOptions {
  title?: string
  language?: string
  includeActionItems?: boolean
  includeDecisions?: boolean
  includeKeyPoints?: boolean
  customPrompt?: string
}

export interface MeetingMinutesResult {
  title: string
  summary: string
  keyPoints: string[]
  actionItems: Array<{
    description: string
    assignee?: string
    priority: 'low' | 'medium' | 'high'
  }>
  decisions: Array<{
    description: string
    decisionMaker?: string
    context?: string
  }>
  nextSteps: string[]
}

export class DeepSeekAIService {
  private apiKey: string
  private baseURL: string
  private defaultModel: string
  public useMockMode: boolean = false

  constructor(useMockMode: boolean = false) {
    this.apiKey = process.env.DEEPSEEK_API_KEY || ''
    this.baseURL = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
    this.defaultModel = 'deepseek-chat'

    // 调试：记录初始化时的环境变量
    logger.info('AIService初始化:', {
      USE_MOCK_AI_SERVICE: process.env.USE_MOCK_AI_SERVICE,
      NODE_ENV: process.env.NODE_ENV,
      useMockMode_param: useMockMode,
      final_useMockMode: useMockMode || process.env.USE_MOCK_AI_SERVICE === 'true'
    })

    this.useMockMode = useMockMode || process.env.USE_MOCK_AI_SERVICE === 'true'
  }

  /**
   * 生成聊天完成
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 2000,
      topP = 0.9,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stream = false
    } = options

    try {
      logger.info('🤖 调用 DeepSeek API:', {
        model,
        temperature,
        maxTokens,
        messagesCount: messages.length,
        url: `${this.baseURL}/v1/chat/completions`
      })

      const startTime = Date.now()

      const response = await axios.post(
        `${this.baseURL}/v1/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
          stream
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60秒超时
        }
      )

      const duration = Date.now() - startTime

      logger.info('✅ DeepSeek API 调用成功:', {
        duration: `${duration}ms`,
        model: response.data.model,
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens,
        totalTokens: response.data.usage?.total_tokens
      })

      return response.data
    } catch (error) {
      logger.error('DeepSeek API 调用失败:', error)
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`DeepSeek API 错误: ${error.response.data?.error?.message || error.message}`)
      }
      throw new Error('AI 服务调用失败')
    }
  }

  /**
   * Mock模式：生成会议纪要
   */
  private async mockGenerateMeetingMinutes(
    transcriptionText: string,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
    logger.info('使用Mock AI服务生成会议纪要')

    // 模拟AI处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000))

    const title = options.title || '产品规划讨论会议'

    // 根据转录内容生成模拟的会议纪要
    const result: MeetingMinutesResult = {
      title,
      summary: '本次会议主要讨论了下一季度的产品规划和技术方案。团队成员就用户需求、市场反馈、技术实现方案等方面进行了深入探讨，明确了项目的执行计划和时间安排。会议氛围积极，各方均积极分享了自己的观点和建议。',
      keyPoints: [
        '下一季度产品规划需要重点关注用户体验优化',
        '市场反馈显示用户需求呈现增长趋势',
        '技术方案需要考虑可扩展性和维护性',
        '项目时间安排需要进行适当调整以保证质量',
        '团队协作和沟通机制需要进一步完善'
      ],
      actionItems: [
        {
          description: '完成产品需求文档的细化和评审',
          assignee: '产品经理',
          priority: 'high'
        },
        {
          description: '制定详细的技术实现方案和架构设计',
          assignee: '技术负责人',
          priority: 'high'
        },
        {
          description: '进行用户调研，收集更多市场反馈',
          assignee: '市场团队',
          priority: 'medium'
        },
        {
          description: '优化现有系统的用户体验',
          assignee: 'UI/UX团队',
          priority: 'medium'
        },
        {
          description: '制定项目里程碑和时间表',
          assignee: '项目经理',
          priority: 'high'
        }
      ],
      decisions: [
        {
          description: '采用渐进式开发策略，优先实现核心功能',
          decisionMaker: '技术总监',
          context: '考虑到时间和资源限制，决定采用MVP方式快速验证'
        },
        {
          description: '每周进行一次产品评审会议，及时调整方向',
          decisionMaker: '产品负责人',
          context: '为了确保产品方向与市场需求保持一致'
        },
        {
          description: '增加用户测试环节，收集实际使用反馈',
          decisionMaker: '团队一致决定',
          context: '提高产品质量和用户满意度'
        }
      ],
      nextSteps: [
        '本周内完成产品需求文档初稿',
        '下周一召开技术方案评审会议',
        '两周内完成核心功能原型开发',
        '月底前完成第一轮用户测试',
        '根据测试反馈进行迭代优化'
      ]
    }

    logger.info('Mock AI服务会议纪要生成完成')
    return result
  }

  /**
   * 生成会议纪要
   */
  async generateMeetingMinutes(
    transcriptionText: string,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
    // 如果启用Mock模式，直接返回模拟数据
    if (this.useMockMode) {
      return this.mockGenerateMeetingMinutes(transcriptionText, options)
    }

    const {
      title = '会议纪要',
      language = 'zh-CN',
      includeActionItems = true,
      includeDecisions = true,
      includeKeyPoints = true,
      customPrompt
    } = options

    const systemPrompt = this.getMeetingMinutesPrompt(language, customPrompt)

    const userPrompt = `
会议标题：${title}
会议转录内容：
${transcriptionText}

请根据以上转录内容生成结构化的会议纪要。
`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    try {
      const response = await this.chatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 4000
      })

      const content = response.choices[0]?.message?.content || ''
      return this.parseMeetingMinutesResult(content, options)
    } catch (error) {
      logger.error('生成会议纪要失败:', error)
      throw new Error('生成会议纪要失败')
    }
  }

  /**
   * 优化会议纪要
   */
  async optimizeMeetingMinutes(
    currentMinutes: string,
    feedback: string,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
    const { language = 'zh-CN' } = options

    const systemPrompt = `你是一个专业的会议纪要优化助手。根据用户的反馈优化会议纪要，使其更加准确、完整和有用。`

    const userPrompt = `
当前会议纪要：
${currentMinutes}

用户反馈：
${feedback}

请根据反馈优化会议纪要，保持结构化格式。
`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    try {
      const response = await this.chatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 4000
      })

      const content = response.choices[0]?.message?.content || ''
      return this.parseMeetingMinutesResult(content, options)
    } catch (error) {
      logger.error('优化会议纪要失败:', error)
      throw new Error('优化会议纪要失败')
    }
  }

  /**
   * 生成会议纪要提示词
   */
  private getMeetingMinutesPrompt(language: string, customPrompt?: string): string {
    const basePrompt = language === 'zh-CN' ? `
你是一个专业的会议纪要生成助手。请根据会议转录内容生成结构化、简洁、准确的会议纪要。

重要要求：
1. 会议摘要(summary)必须控制在100字以内，高度概括核心内容
2. 关键要点(keyPoints)提取2-3个最重要的讨论点，每个要点20字以内
3. 行动项(actionItems)提取1-3个具体的待办事项
4. 决策(decisions)提取0-2个关键决策
5. 下一步(nextSteps)提供1-2个后续行动建议

根据转录内容的长度和复杂度，灵活调整各部分的详细程度。如果转录内容较少，相应减少输出内容。

输出格式请使用JSON格式，包含以下字段：
{
  "title": "会议标题（10字以内）",
  "summary": "会议摘要（100字以内）",
  "keyPoints": ["要点1（20字内）", "要点2（20字内）"],
  "actionItems": [
    {
      "description": "行动项描述",
      "assignee": "负责人（如有）",
      "priority": "high/medium/low"
    }
  ],
  "decisions": [
    {
      "description": "决策描述",
      "decisionMaker": "决策者（如有）",
      "context": "决策背景（可选）"
    }
  ],
  "nextSteps": ["后续行动1", "后续行动2"]
}
` : `
You are a professional meeting minutes generator. Please generate structured, clear, and accurate meeting minutes based on meeting transcriptions.

Requirements:
1. Generate a concise meeting title
2. Provide a meeting summary highlighting key points and conclusions
3. Extract key points and important discussions
4. Identify action items, including assignees and deadlines
5. Record important decisions and decision makers
6. Provide next steps action plan

Please output in JSON format with the following structure:
{
  "title": "Meeting Title",
  "summary": "Meeting Summary",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "actionItems": [
    {
      "description": "Action item description",
      "assignee": "Assignee",
      "priority": "high/medium/low"
    }
  ],
  "decisions": [
    {
      "description": "Decision description",
      "decisionMaker": "Decision maker",
      "context": "Decision context"
    }
  ],
  "nextSteps": ["Next step 1", "Next step 2", ...]
}
`

    return customPrompt ? `${basePrompt}\n\n${customPrompt}` : basePrompt
  }

  /**
   * 解析会议纪要结果
   */
  private parseMeetingMinutesResult(content: string, options: MeetingMinutesOptions): MeetingMinutesResult {
    try {
      // 尝试从内容中提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          title: parsed.title || options.title || '会议纪要',
          summary: parsed.summary || '',
          keyPoints: parsed.keyPoints || [],
          actionItems: parsed.actionItems || [],
          decisions: parsed.decisions || [],
          nextSteps: parsed.nextSteps || []
        }
      }

      // 如果无法解析JSON，返回基本结构
      return {
        title: options.title || '会议纪要',
        summary: content,
        keyPoints: [],
        actionItems: [],
        decisions: [],
        nextSteps: []
      }
    } catch (error) {
      logger.error('解析会议纪要结果失败:', error)
      return {
        title: options.title || '会议纪要',
        summary: content,
        keyPoints: [],
        actionItems: [],
        decisions: [],
        nextSteps: []
      }
    }
  }

  /**
   * 检查API可用性
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.chatCompletion([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 10 })
      return !!response.choices?.[0]?.message?.content
    } catch (error) {
      logger.error('DeepSeek API 可用性检查失败:', error)
      return false
    }
  }
}

// 导出单例实例
export const aiService = new DeepSeekAIService()