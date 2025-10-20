// @ts-nocheck
import { Response } from 'express'
import { validationResult } from 'express-validator'
import { Meeting } from '@/models/Meeting'
import { User } from '@/models/User'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest, requireOwnerOrAdmin } from '@/middleware/auth'
import { logger } from '@/utils/logger'
import { emitToMeeting } from '@/utils/socket'
import { generateUUID } from '@/utils/utils'

// 创建会议
export const createMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { title, description, participants, scheduledStartTime, scheduledEndTime, settings } = req.body
  const host = req.user!._id

  // 创建会议
  const meeting = new Meeting({
    title,
    description,
    host,
    scheduledStartTime,
    scheduledEndTime,
    settings: {
      allowRecording: true,
      enableTranscription: true,
      enableVoiceprint: true,
      autoGenerateMinutes: true,
      language: 'zh-CN',
      ...settings
    }
  })

  // 添加参与者
  if (participants && participants.length > 0) {
    for (const participant of participants) {
      // 如果参与者是系统用户，获取用户信息
      if (participant.userId) {
        const user = await User.findById(participant.userId)
        if (user) {
          meeting.addParticipant(
            user._id,
            user.name,
            user.email,
            participant.role || 'participant'
          )
        }
      } else {
        // 外部参与者
        meeting.addParticipant(
          generateUUID(),
          participant.name,
          participant.email,
          participant.role || 'participant'
        )
      }
    }
  }

  await meeting.save()
  await meeting.populate('host', 'username name avatar')

  logger.info(`会议创建成功: ${meeting._id} by ${req.user!.email}`)

  res.status(201).json({
    success: true,
    message: '会议创建成功',
    data: { meeting }
  })
})

// 获取会议列表
export const getMeetings = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id
  const { status, limit = 20, skip = 0, search } = req.query

  // 构建查询条件
  let query: any = {
    $or: [
      { host: userId },
      { 'participants.userId': userId }
    ]
  }

  if (status) {
    query.status = status
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ]
  }

  const meetings = await Meeting.find(query)
    .populate('host', 'username name avatar')
    .populate('participants.userId', 'username name avatar')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip))

  const total = await Meeting.countDocuments(query)

  res.json({
    success: true,
    data: {
      meetings,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: total > Number(skip) + Number(limit)
      }
    }
  })
})

// 获取单个会议
export const getMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
    .populate('host', 'username name avatar')
    .populate('participants.userId', 'username name avatar')

  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // Demo模式：放宽权限检查，允许所有已登录用户访问
  // 只在生产环境才严格检查权限
  const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true'

  if (!isDemoMode) {
    // 生产环境：检查权限
    if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
      res.status(403).json({
        success: false,
        message: '无权访问此会议'
      })
      return
    }
  }

  res.json({
    success: true,
    data: { meeting }
  })
})

// 更新会议
export const updateMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const { id } = req.params
  const userId = req.user!._id
  const { title, description, scheduledStartTime, scheduledEndTime, settings } = req.body

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限（只有主持人可以更新会议）
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以更新会议'
    })
    return
  }

  // 检查会议状态
  if (meeting.status === 'completed' || meeting.status === 'in_progress') {
    res.status(400).json({
      success: false,
      message: '会议已开始或结束，无法更新'
    })
    return
  }

  // 更新会议信息
  if (title) meeting.title = title
  if (description !== undefined) meeting.description = description
  if (scheduledStartTime) meeting.scheduledStartTime = scheduledStartTime
  if (scheduledEndTime) meeting.scheduledEndTime = scheduledEndTime
  if (settings) meeting.settings = { ...meeting.settings, ...settings }

  await meeting.save()
  await meeting.populate('host', 'username name avatar')

  logger.info(`会议更新成功: ${meeting._id} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议更新成功',
    data: { meeting }
  })
})

// 删除会议
export const deleteMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限（只有主持人可以删除会议）
  if (!meeting.isHost(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '只有主持人可以删除会议'
    })
    return
  }

  // 检查会议状态
  if (meeting.status === 'in_progress') {
    res.status(400).json({
      success: false,
      message: '会议进行中，无法删除'
    })
    return
  }

  await Meeting.findByIdAndDelete(id)

  logger.info(`会议删除成功: ${id} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议删除成功'
  })
})

// 加入会议
export const joinMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查会议状态
  if (meeting.status !== 'in_progress') {
    res.status(400).json({
      success: false,
      message: '会议未开始'
    })
    return
  }

  // 添加用户为参与者
  if (!meeting.isParticipant(userId.toString())) {
    const user = req.user!
    meeting.addParticipant(user._id, user.name, user.email, 'participant')
    await meeting.save()
  }

  // 更新参与者状态为已加入
  meeting.updateParticipantStatus(userId.toString(), 'joined')
  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(id, 'participant-joined', {
    userId: req.user!._id,
    name: req.user!.name,
    timestamp: new Date()
  })

  logger.info(`用户加入会议: ${req.user!.email} -> ${id}`)

  res.json({
    success: true,
    message: '加入会议成功',
    data: { meeting }
  })
})

// 离开会议
export const leaveMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 更新参与者状态为已离开
  meeting.updateParticipantStatus(userId.toString(), 'left')
  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(id, 'participant-left', {
    userId: req.user!._id,
    name: req.user!.name,
    timestamp: new Date()
  })

  logger.info(`用户离开会议: ${req.user!.email} -> ${id}`)

  res.json({
    success: true,
    message: '离开会议成功'
  })
})

// 开始会议
export const startMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
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
      message: '只有主持人可以开始会议'
    })
    return
  }

  // 检查会议状态
  if (meeting.status !== 'scheduled') {
    res.status(400).json({
      success: false,
      message: '会议已经开始或结束'
    })
    return
  }

  // 开始会议
  meeting.startMeeting()
  await meeting.save()

  // 通知所有参与者
  emitToMeeting(id, 'meeting-started', {
    meetingId: meeting._id,
    title: meeting.title,
    startTime: meeting.actualStartTime
  })

  logger.info(`会议开始: ${id} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议开始成功',
    data: { meeting }
  })
})

// 结束会议
export const endMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id

  const meeting = await Meeting.findById(id)
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
      message: '只有主持人可以结束会议'
    })
    return
  }

  // 检查会议状态
  if (meeting.status !== 'in_progress') {
    res.status(400).json({
      success: false,
      message: '会议未开始'
    })
    return
  }

  // 结束会议
  meeting.endMeeting()
  await meeting.save()

  // 通知所有参与者
  emitToMeeting(id, 'meeting-ended', {
    meetingId: meeting._id,
    title: meeting.title,
    endTime: meeting.actualEndTime
  })

  logger.info(`会议结束: ${id} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议结束成功',
    data: { meeting }
  })
})

// 获取活跃会议列表
export const getActiveMeetings = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const meetings = await Meeting.getActiveMeetings()

  res.json({
    success: true,
    data: { meetings }
  })
})

// AI 聊天 - 针对会议内容
export const chatWithMeeting = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const { message } = req.body
  const userId = req.user!._id

  if (!message || !message.trim()) {
    res.status(400).json({
      success: false,
      message: '消息内容不能为空'
    })
    return
  }

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // Demo模式：放宽权限检查
  const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true'
  if (!isDemoMode && !meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权访问此会议'
    })
    return
  }

  // 构建上下文信息
  let contextText = `会议标题：${meeting.title}\n\n`

  // 添加会议纪要上下文
  if (meeting.minutes) {
    contextText += `## 会议纪要\n\n`
    contextText += `**摘要**：${meeting.minutes.summary}\n\n`

    if (meeting.minutes.keyPoints && meeting.minutes.keyPoints.length > 0) {
      contextText += `**关键要点**：\n`
      meeting.minutes.keyPoints.forEach((point, idx) => {
        contextText += `${idx + 1}. ${point}\n`
      })
      contextText += `\n`
    }

    if (meeting.minutes.actionItems && meeting.minutes.actionItems.length > 0) {
      contextText += `**行动项**：\n`
      meeting.minutes.actionItems.forEach((item, idx) => {
        contextText += `${idx + 1}. ${item.description} (负责人: ${item.assignee}, 优先级: ${item.priority})\n`
      })
      contextText += `\n`
    }
  }

  // 添加转录内容上下文（限制长度）
  if (meeting.transcriptions && meeting.transcriptions.length > 0) {
    contextText += `## 会议转录摘要\n\n`
    const recentTranscriptions = meeting.transcriptions.slice(-10) // 只取最近10条
    recentTranscriptions.forEach(trans => {
      contextText += `[${trans.speakerName || trans.speakerId}]: ${trans.text}\n`
    })
  }

  // 使用AI服务生成回复
  try {
    const { aiService } = await import('@/services/aiService')

    const systemPrompt = `你是一个专业的会议助手，帮助用户理解和优化会议内容。
你的回答应该：
1. 基于会议的实际内容和纪要
2. 简洁明了，重点突出
3. 提供有价值的见解和建议
4. 使用Markdown格式，使内容更易读

当前会议上下文：
${contextText}`

    const response = await aiService.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], {
      temperature: 0.7,
      maxTokens: 1000
    })

    const aiResponse = response.choices[0]?.message?.content || '抱歉，我无法生成回复。'

    logger.info(`AI聊天: 会议=${id}, 用户=${req.user!.email}, 消息="${message}"`)

    res.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('AI聊天失败:', error)

    // 失败时返回友好的错误消息
    res.status(500).json({
      success: false,
      message: 'AI服务暂时不可用，请稍后再试'
    })
  }
})

// 更新会议纪要
export const updateMeetingMinutes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!._id
  const minutesUpdate = req.body

  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // Demo模式：放宽权限检查
  const isDemoMode = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true'
  if (!isDemoMode && !meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权修改此会议纪要'
    })
    return
  }

  // 更新纪要
  if (!meeting.minutes) {
    meeting.minutes = {} as any
  }

  if (minutesUpdate.title) meeting.minutes.title = minutesUpdate.title
  if (minutesUpdate.summary) meeting.minutes.summary = minutesUpdate.summary
  if (minutesUpdate.keyPoints) meeting.minutes.keyPoints = minutesUpdate.keyPoints
  if (minutesUpdate.actionItems) meeting.minutes.actionItems = minutesUpdate.actionItems
  if (minutesUpdate.decisions) meeting.minutes.decisions = minutesUpdate.decisions

  await meeting.save()

  logger.info(`会议纪要更新成功: ${id} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '会议纪要更新成功',
    data: { minutes: meeting.minutes }
  })
})

/**
 * 添加参与者
 */
export const addMeetingParticipant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { email, name, role = 'participant' } = req.body
  const userId = req.user!._id.toString()

  logger.info(`添加参与者请求: 会议=${id}, 邮箱=${email}, 角色=${role}`)

  // 验证输入
  if (!email) {
    res.status(400).json({
      success: false,
      message: '邮箱地址不能为空'
    })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({
      success: false,
      message: '邮箱地址格式不正确'
    })
    return
  }

  // 查找会议
  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限：只有主持人可以添加参与者（Demo模式除外）
  const isDemoMode = userId === 'demo-user-id'
  if (!isDemoMode && !meeting.isHost(userId)) {
    res.status(403).json({
      success: false,
      message: '只有会议主持人可以添加参与者'
    })
    return
  }

  // 检查参与者是否已存在
  const existingParticipant = meeting.participants.find(p => p.email === email)
  if (existingParticipant) {
    res.status(400).json({
      success: false,
      message: '该参与者已在会议中'
    })
    return
  }

  // 生成临时userId（如果没有在系统中注册）
  const participantName = name || email.split('@')[0]
  const participantUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 添加参与者
  meeting.addParticipant(participantUserId, participantName, email, role)
  await meeting.save()

  // 获取新添加的参与者
  const newParticipant = meeting.participants[meeting.participants.length - 1]

  logger.info(`参与者添加成功: ${email} 加入会议 ${id}`)

  // 广播参与者加入事件
  emitToMeeting(id, 'participant-added', {
    participant: newParticipant
  })

  res.status(201).json({
    success: true,
    message: '参与者添加成功',
    data: {
      participant: {
        id: newParticipant._id,
        userId: newParticipant.userId,
        name: newParticipant.name,
        email: newParticipant.email,
        role: newParticipant.role,
        joinedAt: newParticipant.joinedAt
      }
    }
  })
})

/**
 * 移除参与者
 */
export const removeMeetingParticipant = asyncHandler(async (req: Request, res: Response) => {
  const { id, participantId } = req.params
  const userId = req.user!._id.toString()

  logger.info(`移除参与者请求: 会议=${id}, 参与者=${participantId}`)

  // 查找会议
  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限：只有主持人可以移除参与者（Demo模式除外）
  const isDemoMode = userId === 'demo-user-id'
  if (!isDemoMode && !meeting.isHost(userId)) {
    res.status(403).json({
      success: false,
      message: '只有会议主持人可以移除参与者'
    })
    return
  }

  // 查找参与者
  const participantIndex = meeting.participants.findIndex(
    p => p._id && p._id.toString() === participantId
  )

  if (participantIndex === -1) {
    res.status(404).json({
      success: false,
      message: '参与者不存在'
    })
    return
  }

  const removedParticipant = meeting.participants[participantIndex]

  // 移除参与者（通过splice直接删除）
  meeting.participants.splice(participantIndex, 1)
  await meeting.save()

  logger.info(`参与者移除成功: ${removedParticipant.email} 从会议 ${id} 移除`)

  // 广播参与者移除事件
  emitToMeeting(id, 'participant-removed', {
    participantId
  })

  res.json({
    success: true,
    message: '参与者移除成功',
    data: { participantId }
  })
})

/**
 * 更新参与者信息
 */
export const updateMeetingParticipant = asyncHandler(async (req: Request, res: Response) => {
  const { id, participantId } = req.params
  const { name, role } = req.body
  const userId = req.user!._id.toString()

  logger.info(`更新参与者请求: 会议=${id}, 参与者=${participantId}`)

  // 查找会议
  const meeting = await Meeting.findById(id)
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '会议不存在'
    })
    return
  }

  // 检查权限：只有主持人可以更新参与者（Demo模式除外）
  const isDemoMode = userId === 'demo-user-id'
  if (!isDemoMode && !meeting.isHost(userId)) {
    res.status(403).json({
      success: false,
      message: '只有会议主持人可以更新参与者信息'
    })
    return
  }

  // 查找参与者
  const participant = meeting.participants.find(
    p => p._id && p._id.toString() === participantId
  )

  if (!participant) {
    res.status(404).json({
      success: false,
      message: '参与者不存在'
    })
    return
  }

  // 更新参与者信息
  if (name) participant.name = name
  if (role && ['participant', 'observer', 'moderator'].includes(role)) {
    participant.role = role as any
  }

  await meeting.save()

  logger.info(`参与者更新成功: ${participant.email} 在会议 ${id}`)

  // 广播参与者更新事件
  emitToMeeting(id, 'participant-updated', {
    participant: {
      id: participant._id,
      userId: participant.userId,
      name: participant.name,
      email: participant.email,
      role: participant.role
    }
  })

  res.json({
    success: true,
    message: '参与者信息更新成功',
    data: {
      participant: {
        id: participant._id,
        userId: participant.userId,
        name: participant.name,
        email: participant.email,
        role: participant.role,
        joinedAt: participant.joinedAt
      }
    }
  })
})