import { Request, Response, NextFunction } from 'express'
import { logger } from '@/utils/logger'

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export class CustomError extends Error implements AppError {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let { statusCode = 500, message } = error

  // 记录错误日志
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  // MongoDB 错误处理
  if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation Error: ' + Object.values((error as any).errors).map((e: any) => e.message).join(', ')
  } else if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid ID format'
  } else if ((error as any).code === 11000) {
    statusCode = 400
    message = 'Duplicate field value'
  }

  // JWT 错误处理
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
  }

  // 开发环境返回详细错误信息
  const response: any = {
    success: false,
    error: message,
    statusCode,
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack
  }

  res.status(statusCode).json(response)
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const createError = (message: string, statusCode: number = 500): CustomError => {
  return new CustomError(message, statusCode)
}