// @ts-nocheck
import { Response } from 'express'
import { validationResult } from 'express-validator'
import { Meeting } from '@/models/Meeting'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { aiService } from '@/services/aiService'
import { logger } from '@/utils/logger'
import { emitToMeeting } from '@/utils/socket'

// AI聊天
export const chatWithAI = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { messages, options = {} } = req.body
  const userId = req.user!._id

  try {
    const response = await aiService.chatCompletion(messages, options)

    res.json({
      success: true,
      data: {
        message: response.choices[0]?.message,
        usage: response.usage
      }
    })
  } catch (error) {
    logger.error('AI聊天失败:', error)
    res.status(500).json({
      success: false,
      message: 'AI服务暂时不可用，请稍后重试'
    })
  }
})

// 流式AI聊天
export const streamChatWithAI = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { messages, options = {} } = req.body
  const userId = req.user!._id

  // 设置响应头
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  try {
    const stream = aiService.streamChatCompletion(messages, options)

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    logger.error('流式AI聊天失败:', error)
    res.write(`data: ${JSON.stringify({ error: 'AI服务暂时不可用' })}\n\n`)
    res.end()
  }
})

// 生成会议纪要
export const generateMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { meetingId, options = {} } = req.body
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权限访问此会议'
    })
    return
  }

  // 检查是否有转录内容
  if (meeting.transcriptions.length === 0) {
    res.status(400).json({
      success: false,
      message: '会议没有转录内容，无法生成纪要'
    })
    return
  }

  try {
    // 构建转录文本
    const transcriptionText = meeting.transcriptions
      .map(t => `[${t.speakerName}]: ${t.content}`)
      .join('\n')

    // 生成会议纪要
    const minutesResult = await aiService.generateMeetingMinutes(transcriptionText, {
      title: meeting.title,
      language: meeting.settings.language,
      ...options
    })

    // 保存纪要到会议中
    meeting.minutes = {
      id: `minutes_${Date.now()}`,
      title: minutesResult.title,
      summary: minutesResult.summary,
      keyPoints: minutesResult.keyPoints,
      actionItems: minutesResult.actionItems.map(item => ({
        description: item.description,
        assignee: item.assignee || '未指定',
        priority: item.priority
      })) as any,
      decisions: minutesResult.decisions.map(dec => ({
        description: dec.description,
        decisionMaker: dec.decisionMaker || '未指定',
        timestamp: new Date()
      })) as any,
      generatedAt: new Date(),
      status: 'draft'
    }

    await meeting.save()

    // 通知会议中的其他用户
    emitToMeeting(meetingId, 'minutes-generated', {
      meetingId,
      minutesId: meeting.minutes?.id,
      title: meeting.minutes.title,
      timestamp: new Date()
    })

    logger.info(`会议纪要生成成功: ${meetingId}`)

    res.json({
      success: true,
      message: '会议纪要生成成功',
      data: {
        minutes: meeting.minutes,
        result: minutesResult
      }
    })
  } catch (error) {
    logger.error('生成会议纪要失败:', error)
    res.status(500).json({
      success: false,
      message: '生成会议纪要失败，请稍后重试'
    })
  }
})

// 优化会议纪要
export const optimizeMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { meetingId, feedback, options = {} } = req.body
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以优化会议纪要'
    })
    return
  }

  // 检查是否已有纪要
  if (!meeting.minutes) {
    res.status(400).json({
      success: false,
      message: '会议没有纪要，请先生成纪要'
    })
    return
  }

  try {
    // 构建当前纪要文本
    const currentMinutesText = `
标题: ${meeting.minutes.title}
摘要: ${meeting.minutes.summary}
关键要点: ${meeting.minutes.keyPoints.join('\n')}
行动项: ${meeting.minutes.actionItems.map(item => `- ${item.description} (负责人: ${item.assignee || '未指定'}, 优先级: ${item.priority})`).join('\n')}
决策: ${meeting.minutes.decisions.map(dec => `- ${dec.description} (决策者: ${dec.decisionMaker || '未指定'})`).join('\n')}
`

    // 优化会议纪要
    const optimizedResult = await aiService.optimizeMeetingMinutes(currentMinutesText, feedback, {
      title: meeting.title,
      language: meeting.settings.language,
      ...options
    })

    // 更新纪要
    meeting.minutes.title = optimizedResult.title
    meeting.minutes.summary = optimizedResult.summary
    meeting.minutes.keyPoints = optimizedResult.keyPoints
    meeting.minutes.actionItems = optimizedResult.actionItems.map(item => ({
      description: item.description,
      assignee: item.assignee || '未指定',
      priority: item.priority
    })) as any
    meeting.minutes.decisions = optimizedResult.decisions.map(dec => ({
      description: dec.description,
      decisionMaker: dec.decisionMaker || '未指定',
      timestamp: new Date()
    })) as any
    meeting.minutes.status = 'reviewing' // 标记为审核中

    await meeting.save()

    // 通知会议中的其他用户
    emitToMeeting(meetingId, 'minutes-optimized', {
      meetingId,
      minutesId: meeting.minutes.id,
      title: meeting.minutes.title,
      timestamp: new Date()
    })

    logger.info(`会议纪要优化成功: ${meetingId}`)

    res.json({
      success: true,
      message: '会议纪要优化成功',
      data: {
        minutes: meeting.minutes,
        result: optimizedResult
      }
    })
  } catch (error) {
    logger.error('优化会议纪要失败:', error)
    res.status(500).json({
      success: false,
      message: '优化会议纪要失败，请稍后重试'
    })
  }
})

// 批准会议纪要
export const approveMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.params
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以批准会议纪要'
    })
    return
  }

  // 检查是否已有纪要
  if (!meeting.minutes) {
    res.status(400).json({
      success: false,
      message: '会议没有纪要'
    })
    return
  }

  // 批准纪要
  meeting.minutes.status = 'approved'
  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'minutes-approved', {
    meetingId,
    minutesId: meeting.minutes.id,
    timestamp: new Date()
  })

  logger.info(`会议纪要批准: ${meetingId} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议纪要已批准',
    data: { minutes: meeting.minutes }
  })
})

// 获取会议纪要
export const getMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.params
  const userId = req.user!._id

  // 检查会议是否存在
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权限访问此会议'
    })
    return
  }

  res.json({
    success: true,
    data: {
      minutes: meeting.minutes,
      transcriptions: meeting.transcriptions
    }
  })
})

// 检查AI服务状态
export const checkAIStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const isAvailable = await aiService.checkAvailability()

    res.json({
      success: true,
      data: {
        available: isAvailable,
        service: 'DeepSeek AI',
        timestamp: new Date()
      }
    })
  } catch (error) {
    res.json({
      success: true,
      data: {
        available: false,
        service: 'DeepSeek AI',
        error: 'AI服务检查失败',
        timestamp: new Date()
      }
    })
  }
})