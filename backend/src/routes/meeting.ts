import { Router } from 'express'
import {
  createMeeting,
  getMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  startMeeting,
  endMeeting,
  getActiveMeetings,
  chatWithMeeting,
  updateMeetingMinutes,
  addMeetingParticipant,
  removeMeetingParticipant,
  updateMeetingParticipant
} from '@/controllers/meetingController'
import {
  uploadAudioAndGenerateMinutes,
  triggerMinutesGeneration
} from '@/controllers/minutesController'
import { authenticateToken } from '@/middleware/auth'
import { upload } from '@/middleware/upload'
import {
  validateCreateMeeting,
  validateUpdateMeeting
} from '@/validators/meetingValidators'

const router = Router()

// 所有会议路由都需要认证
router.use(authenticateToken)

// 创建会议
router.post('/', validateCreateMeeting, createMeeting)

// 获取会议列表
router.get('/', getMeetings)

// 获取活跃会议列表
router.get('/active', getActiveMeetings)

// 获取单个会议
router.get('/:id', getMeeting)

// 更新会议
router.put('/:id', validateUpdateMeeting, updateMeeting)

// 删除会议
router.delete('/:id', deleteMeeting)

// 加入会议
router.post('/:id/join', joinMeeting)

// 离开会议
router.post('/:id/leave', leaveMeeting)

// 开始会议
router.post('/:id/start', startMeeting)

// 结束会议
router.post('/:id/end', endMeeting)

// 上传音频并生成纪要
router.post(
  '/:meetingId/upload-audio',
  upload.single('audio'),
  uploadAudioAndGenerateMinutes
)

// 手动触发纪要生成
router.post('/:meetingId/generate-minutes', triggerMinutesGeneration)

// AI 聊天
router.post('/:id/chat', chatWithMeeting)

// 更新会议纪要
router.patch('/:id/minutes', updateMeetingMinutes)

// 参与者管理
router.post('/:id/participants', addMeetingParticipant)
router.delete('/:id/participants/:participantId', removeMeetingParticipant)
router.patch('/:id/participants/:participantId', updateMeetingParticipant)

export default router