// @ts-nocheck
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, IUser } from '@/models/User'
import { createError } from '@/middleware/errorHandler'

// 扩展 Request 接口
export interface AuthenticatedRequest extends Request {
  user?: IUser
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

// JWT 认证中间件
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      throw createError('访问令牌缺失', 401)
    }

    // 验证 JWT 令牌
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET 环境变量未设置')
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload

    // 查找用户
    const user = await User.findById(decoded.userId)
    if (!user) {
      throw createError('用户不存在', 401)
    }

    if (!user.isActive) {
      throw createError('用户账户已被禁用', 401)
    }

    // 将用户信息添加到请求对象
    req.user = user
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('无效的访问令牌', 401))
    } else if (error instanceof jwt.TokenExpiredError) {
      next(createError('访问令牌已过期', 401))
    } else {
      next(error)
    }
  }
}

// 可选认证中间件（不强制要求认证）
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const jwtSecret = process.env.JWT_SECRET
      if (!jwtSecret) {
        return next()
      }

      const decoded = jwt.verify(token, jwtSecret) as JWTPayload
      const user = await User.findById(decoded.userId)

      if (user && user.isActive) {
        req.user = user
      }
    }

    next()
  } catch (error) {
    // 可选认证失败时不抛出错误，继续执行
    next()
  }
}

// 角色权限中间件
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('需要认证', 401))
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    if (!allowedRoles.includes(req.user.role)) {
      return next(createError('权限不足', 403))
    }

    next()
  }
}

// 管理员权限中间件
export const requireAdmin = requireRole('admin')

// 用户本人或管理员权限中间件
export const requireOwnerOrAdmin = (getUserId: (req: Request) => string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('需要认证', 401))
    }

    const targetUserId = getUserId(req)
    const isOwner = req.user._id.toString() === targetUserId
    const isAdmin = req.user.role === 'admin'

    if (!isOwner && !isAdmin) {
      return next(createError('只能访问自己的资源', 403))
    }

    next()
  }
}

// API 密钥认证中间件（用于第三方服务）
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string

    if (!apiKey) {
      throw createError('API 密钥缺失', 401)
    }

    // 这里可以实现 API 密钥验证逻辑
    // 暂时使用环境变量中的密钥
    const validApiKey = process.env.API_KEY

    if (!validApiKey || apiKey !== validApiKey) {
      throw createError('无效的 API 密钥', 401)
    }

    next()
  } catch (error) {
    next(error)
  }
}

// 生成JWT令牌的辅助函数
export const generateTokens = (user: IUser) => {
  const jwtSecret = process.env.JWT_SECRET
  const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || jwtSecret

  if (!jwtSecret) {
    throw new Error('JWT_SECRET 环境变量未设置')
  }

  const accessToken = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  )

  const refreshToken = jwt.sign(
    { userId: user._id },
    refreshTokenSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )

  return { accessToken, refreshToken }
}

// 验证刷新令牌
export const verifyRefreshToken = (token: string): JWTPayload => {
  const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET

  if (!refreshTokenSecret) {
    throw new Error('JWT_REFRESH_SECRET 环境变量未设置')
  }

  return jwt.verify(token, refreshTokenSecret) as JWTPayload
}