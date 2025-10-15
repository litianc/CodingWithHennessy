import { Response } from 'express'
import multer from 'multer'
import { validationResult } from 'express-validator'
import { Meeting } from '@/models/Meeting'
import { asyncHandler } from '@/middleware/errorHandler'
import { AuthenticatedRequest } from '@/middleware/auth'
import { audioService } from '@/services/audioService'
import { logger } from '@/utils/logger'
import { emitToMeeting } from '@/utils/socket'

// 配置 multer 用于文件上传
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/webm',
      'audio/ogg',
      'audio/m4a'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的音频格式'))
    }
  }
})

// 开始录音
export const startRecording = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.body
  const userId = req.user!._id

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
      message: '无权限操作此会议'
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

  // 检查是否允许录音
  if (!meeting.settings.allowRecording) {
    res.status(400).json({
      success: false,
      message: '此会议不允许录音'
    })
    return
  }

  // 检查是否已经在录音
  if (meeting.recording) {
    res.status(400).json({
      success: false,
      message: '会议正在录音中'
    })
    return
  }

  // 创建录音记录
  const recordingId = `recording_${Date.now()}`
  const filename = `${recordingId}.webm`

  meeting.recording = {
    id: recordingId,
    filename,
    duration: 0,
    size: 0,
    format: 'webm',
    url: `/api/recordings/${filename}`,
    startedAt: new Date()
  }

  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'recording-started', {
    recordingId,
    startedAt: meeting.recording.startedAt
  })

  logger.info(`会议录音开始: ${meetingId} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '录音开始成功',
    data: {
      recordingId,
      filename
    }
  })
})

// 停止录音
export const stopRecording = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.body
  const userId = req.user!._id

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
      message: '只有主持人可以停止录音'
    })
    return
  }

  // 检查是否在录音
  if (!meeting.recording) {
    res.status(400).json({
      success: false,
      message: '会议未在录音'
    })
    return
  }

  // 更新录音记录
  meeting.recording.endedAt = new Date()
  if (meeting.recording.startedAt) {
    meeting.recording.duration = Math.floor(
      (meeting.recording.endedAt.getTime() - meeting.recording.startedAt.getTime()) / 1000
    )
  }

  // 获取实际文件大小
  meeting.recording.size = await audioService.getFileSize(meeting.recording.filename)

  await meeting.save()

  // 通知会议中的其他用户
  emitToMeeting(meetingId, 'recording-stopped', {
    recordingId: meeting.recording.id,
    endedAt: meeting.recording.endedAt,
    duration: meeting.recording.duration
  })

  logger.info(`会议录音停止: ${meetingId} by ${req.user!.email}`)

  res.json({
    success: true,
    message: '录音停止成功',
    data: {
      recordingId: meeting.recording.id,
      duration: meeting.recording.duration,
      filename: meeting.recording.filename
    }
  })
})

// 上传音频文件
export const uploadAudio = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { meetingId } = req.body
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
      message: '无权限操作此会议'
    })
    return
  }

  // 检查是否有上传的文件
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: '请选择要上传的音频文件'
    })
    return
  }

  try {
    // 保存音频文件
    const filename = await audioService.saveAudioFile(req.file.buffer, req.file.originalname)

    // 获取音频元数据
    const metadata = await audioService.getAudioMetadata(audioService.getFilePath(filename))

    // 创建录音记录
    const recordingId = `upload_${Date.now()}`
    meeting.recording = {
      id: recordingId,
      filename,
      duration: metadata.duration,
      size: metadata.size,
      format: metadata.format,
      url: `/api/recordings/${filename}`,
      startedAt: new Date(),
      endedAt: new Date()
    }

    await meeting.save()

    logger.info(`音频文件上传成功: ${filename} by ${req.user!.email}`)

    res.json({
      success: true,
      message: '音频文件上传成功',
      data: {
        recordingId,
        filename,
        duration: metadata.duration,
        size: metadata.size,
        format: metadata.format
      }
    })
  } catch (error) {
    logger.error('音频文件上传失败:', error)
    res.status(500).json({
      success: false,
      message: '音频文件上传失败'
    })
  }
})

// 获取录音文件
export const getRecording = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { filename } = req.params
  const userId = req.user!._id

  // 检查文件是否存在
  const exists = await audioService.fileExists(filename)
  if (!exists) {
    res.status(404).json({
      success: false,
      message: '录音文件不存在'
    })
    return
  }

  // 查找包含此录音的会议
  const meeting = await Meeting.findOne({ 'recording.filename': filename })
  if (!meeting) {
    res.status(404).json({
      success: false,
      message: '找不到对应的会议'
    })
    return
  }

  // 检查权限
  if (!meeting.isHost(userId.toString()) && !meeting.isParticipant(userId.toString())) {
    res.status(403).json({
      success: false,
      message: '无权限访问此录音'
    })
    return
  }

  // 发送文件
  const filePath = audioService.getFilePath(filename)
  res.sendFile(filePath, (err) => {
    if (err) {
      logger.error('发送录音文件失败:', err)
      res.status(500).json({
        success: false,
        message: '获取录音文件失败'
      })
    }
  })
})

// 删除录音
export const deleteRecording = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      message: '只有主持人可以删除录音'
    })
    return
  }

  // 检查是否有录音
  if (!meeting.recording) {
    res.status(400).json({
      success: false,
      message: '会议没有录音'
    })
    return
  }

  try {
    // 删除音频文件
    await audioService.deleteAudioFile(meeting.recording.filename)

    // 删除录音记录
    meeting.recording = undefined
    await meeting.save()

    logger.info(`录音删除成功: ${meeting.recording?.filename} by ${req.user!.email}`)

    res.json({
      success: true,
      message: '录音删除成功'
    })
  } catch (error) {
    logger.error('删除录音失败:', error)
    res.status(500).json({
      success: false,
      message: '删除录音失败'
    })
  }
})

// 导出中间件
export const uploadMiddleware = upload.single('audio')