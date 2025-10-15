import { Router } from 'express'

const router = Router()

// 获取声纹列表
router.get('/', (req, res) => {
  res.json({ message: 'Get voiceprints endpoint' })
})

// 创建声纹
router.post('/', (req, res) => {
  res.json({ message: 'Create voiceprint endpoint' })
})

export default router