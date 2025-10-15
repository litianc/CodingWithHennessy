import { Socket, Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { User } from '@/models/User'
import { logger } from '@/utils/logger'

interface AuthenticatedSocket extends Socket {
  user?: any
}

export const authenticateSocket = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return next(new Error('认证令牌缺失'))
    }

    // 验证 JWT 令牌
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return next(new Error('JWT_SECRET 环境变量未设置'))
    }

    const decoded = jwt.verify(token, jwtSecret) as any

    // 查找用户
    const user = await User.findById(decoded.userId)
    if (!user) {
      return next(new Error('用户不存在'))
    }

    if (!user.isActive) {
      return next(new Error('用户账户已被禁用'))
    }

    // 将用户信息添加到 socket
    socket.user = user

    // 将用户加入个人房间
    socket.join(`user-${user._id}`)

    logger.info(`Socket 认证成功: ${user.email} (${socket.id})`)
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new Error('无效的访问令牌'))
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new Error('访问令牌已过期'))
    } else {
      logger.error('Socket 认证失败:', error)
      next(new Error('认证失败'))
    }
  }
}

/**
 * 检查用户是否有会议权限
 */
export const checkMeetingPermission = (socket: AuthenticatedSocket, meetingId: string, requiredRole?: 'host' | 'participant') => {
  const user = socket.user
  if (!user) {
    throw new Error('用户未认证')
  }

  // 这里可以添加会议权限检查逻辑
  // 比如从数据库或缓存中检查用户是否有权限访问该会议

  return true
}