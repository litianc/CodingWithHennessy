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

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权访问此会议'
    })
    return
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