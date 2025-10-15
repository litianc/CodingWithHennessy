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

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || ''
    this.baseURL = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
    this.defaultModel = 'deepseek-chat'
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
   * 流式聊天完成
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 2000,
      topP = 0.9,
      frequencyPenalty = 0,
      presencePenalty = 0
    } = options

    try {
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
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 60000
        }
      )

      let buffer = ''
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                yield content
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      })

      await new Promise((resolve, reject) => {
        response.data.on('end', resolve)
        response.data.on('error', reject)
      })

    } catch (error) {
      logger.error('DeepSeek 流式 API 调用失败:', error)
      throw new Error('AI 服务调用失败')
    }
  }

  /**
   * 生成会议纪要
   */
  async generateMeetingMinutes(
    transcriptionText: string,
    options: MeetingMinutesOptions = {}
  ): Promise<MeetingMinutesResult> {
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
你是一个专业的会议纪要生成助手。请根据会议转录内容生成结构化、清晰、准确的会议纪要。

要求：
1. 生成简洁明了的会议标题
2. 提供会议内容摘要，突出重点和结论
3. 提取关键要点和重要讨论
4. 识别行动项（Action Items），包括负责人和截止时间
5. 记录重要决策和决策者
6. 提供下一步行动计划

输出格式请使用JSON格式，包含以下字段：
{
  "title": "会议标题",
  "summary": "会议摘要",
  "keyPoints": ["关键要点1", "关键要点2", ...],
  "actionItems": [
    {
      "description": "行动项描述",
      "assignee": "负责人",
      "priority": "high/medium/low"
    }
  ],
  "decisions": [
    {
      "description": "决策描述",
      "decisionMaker": "决策者",
      "context": "决策背景"
    }
  ],
  "nextSteps": ["下一步1", "下一步2", ...]
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