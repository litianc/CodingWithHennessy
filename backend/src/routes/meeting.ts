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
  getActiveMeetings
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

export default router