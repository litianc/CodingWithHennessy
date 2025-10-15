import { Router } from 'express'
import {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  deleteAccount
} from '@/controllers/authController'
import { authenticateToken } from '@/middleware/auth'
import {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateUpdateProfile,
  validateChangePassword
} from '@/validators/authValidators'

const router = Router()

// 公开路由（无需认证）
router.post('/register', validateRegister, register)
router.post('/login', validateLogin, login)
router.post('/refresh-token', validateRefreshToken, refreshToken)

// 需要认证的路由
router.post('/logout', authenticateToken, logout)
router.get('/profile', authenticateToken, getCurrentUser)
router.put('/profile', authenticateToken, validateUpdateProfile, updateProfile)
router.put('/change-password', authenticateToken, validateChangePassword, changePassword)
router.delete('/account', authenticateToken, deleteAccount)

export default router