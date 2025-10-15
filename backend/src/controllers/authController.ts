import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { User } from '@/models/User'
import { asyncHandler } from '@/middleware/errorHandler'
import { generateTokens, verifyRefreshToken, AuthenticatedRequest } from '@/middleware/auth'
import { RedisService } from '@/config/redis'
import { logger } from '@/utils/logger'

const redisService = new RedisService()

// 用户注册
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { username, email, password, name } = req.body

  // 检查用户是否已存在
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (existingUser) {
    res.status(409).json({
      success: false,
      message: existingUser.email === email ? '邮箱已被注册' : '用户名已被使用'
    })
    return
  }

  // 创建新用户
  const user = new User({
    username,
    email,
    password,
    name
  })

  await user.save()

  // 生成令牌
  const { accessToken, refreshToken } = generateTokens(user)

  // 将刷新令牌存储到 Redis
  await redisService.set(
    `refresh_token:${user._id}`,
    refreshToken,
    7 * 24 * 60 * 60 // 7 天
  )

  logger.info(`用户注册成功: ${user.email}`)

  res.status(201).json({
    success: true,
    message: '注册成功',
    data: {
      user: user.getPublicProfile(),
      accessToken,
      refreshToken
    }
  })
})

// 用户登录
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { identifier, password } = req.body // identifier 可以是邮箱或用户名

  // 查找用户
  const user = await User.findByEmailOrUsername(identifier)
  if (!user) {
    res.status(401).json({
      success: false,
      message: '邮箱或用户名不存在'
    })
    return
  }

  // 检查用户是否激活
  if (!user.isActive) {
    res.status(401).json({
      success: false,
      message: '用户账户已被禁用'
    })
    return
  }

  // 验证密码
  const isPasswordValid = await user.comparePassword(password)
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      message: '密码错误'
    })
    return
  }

  // 更新最后登录时间
  user.lastLoginAt = new Date()
  await user.save()

  // 生成令牌
  const { accessToken, refreshToken } = generateTokens(user)

  // 将刷新令牌存储到 Redis
  await redisService.set(
    `refresh_token:${user._id}`,
    refreshToken,
    7 * 24 * 60 * 60 // 7 天
  )

  logger.info(`用户登录成功: ${user.email}`)

  res.json({
    success: true,
    message: '登录成功',
    data: {
      user: user.getPublicProfile(),
      accessToken,
      refreshToken
    }
  })
})

// 刷新令牌
export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      message: '刷新令牌缺失'
    })
    return
  }

  try {
    // 验证刷新令牌
    const decoded = verifyRefreshToken(refreshToken)

    // 查找用户
    const user = await User.findById(decoded.userId)
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      })
      return
    }

    // 检查 Redis 中是否存在该刷新令牌
    const storedToken = await redisService.get(`refresh_token:${user._id}`)
    if (storedToken !== refreshToken) {
      res.status(401).json({
        success: false,
        message: '无效的刷新令牌'
      })
      return
    }

    // 生成新的令牌
    const tokens = generateTokens(user)

    // 更新 Redis 中的刷新令牌
    await redisService.set(
      `refresh_token:${user._id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7 天
    )

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: tokens
    })
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '无效的刷新令牌'
    })
  }
})

// 用户登出
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user

  if (user) {
    // 从 Redis 中删除刷新令牌
    await redisService.del(`refresh_token:${user._id}`)

    logger.info(`用户登出: ${user.email}`)
  }

  res.json({
    success: true,
    message: '登出成功'
  })
})

// 获取当前用户信息
export const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!

  res.json({
    success: true,
    data: {
      user: user.getPublicProfile()
    }
  })
})

// 更新用户信息
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const user = req.user!
  const { name, avatar, preferences, settings } = req.body

  // 更新允许的字段
  if (name !== undefined) user.name = name
  if (avatar !== undefined) user.avatar = avatar
  if (preferences) user.preferences = { ...user.preferences, ...preferences }
  if (settings) user.settings = { ...user.settings, ...settings }

  await user.save()

  logger.info(`用户更新信息: ${user.email}`)

  res.json({
    success: true,
    message: '信息更新成功',
    data: {
      user: user.getPublicProfile()
    }
  })
})

// 修改密码
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const user = req.user!
  const { currentPassword, newPassword } = req.body

  // 验证当前密码
  const isCurrentPasswordValid = await user.comparePassword(currentPassword)
  if (!isCurrentPasswordValid) {
    res.status(400).json({
      success: false,
      message: '当前密码错误'
    })
    return
  }

  // 更新密码
  user.password = newPassword
  await user.save()

  // 删除所有刷新令牌，强制重新登录
  await redisService.del(`refresh_token:${user._id}`)

  logger.info(`用户修改密码: ${user.email}`)

  res.json({
    success: true,
    message: '密码修改成功，请重新登录'
  })
})

// 删除账户
export const deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!

  // 软删除：禁用账户
  user.isActive = false
  await user.save()

  // 删除所有刷新令牌
  await redisService.del(`refresh_token:${user._id}`)

  logger.warn(`用户删除账户: ${user.email}`)

  res.json({
    success: true,
    message: '账户删除成功'
  })
})