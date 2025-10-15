import { Router } from 'express'

const router = Router()

// 发送邮件
router.post('/send', (req, res) => {
  res.json({ message: 'Send email endpoint' })
})

// 获取邮件模板
router.get('/templates', (req, res) => {
  res.json({ message: 'Get email templates endpoint' })
})

export default router