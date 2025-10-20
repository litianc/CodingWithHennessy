import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

// 日志级别
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// 日志颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

// 添加颜色到 winston
winston.addColors(colors)

// 日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

// 生产环境日志格式
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// 创建传输器数组
const transports: winston.transport[] = []

// 控制台输出（始终启用，方便开发调试）
transports.push(
  new winston.transports.Console({
    format,
  }),
)

// 文件输出（开发和生产环境都启用）
const logDir = process.env.LOG_DIR || 'logs'

// 错误日志
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: productionFormat,
    maxSize: '20m',
    maxFiles: '3d', // 开发环境保留3天
    zippedArchive: false, // 开发环境不压缩，方便查看
  }),
)

// 组合日志（所有级别）
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: productionFormat,
    maxSize: '20m',
    maxFiles: '3d', // 开发环境保留3天
    zippedArchive: false,
  }),
)

// 仅开发环境：额外的调试日志文件
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'debug-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
      ),
      maxSize: '20m',
      maxFiles: '3d',
      zippedArchive: false,
    }),
  )
}

// 创建 logger 实例
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: productionFormat,
  transports,
  exitOnError: false,
})

// 开发环境下的 HTTP 请求日志
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  )
}

// 错误处理
logger.on('error', (error) => {
  console.error('Logger error:', error)
})

// 导出便捷方法
export const logError = (message: string, error?: any) => {
  if (error) {
    logger.error(`${message}: ${error.message || error}`, { stack: error.stack })
  } else {
    logger.error(message)
  }
}

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta)
}

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta)
}

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta)
}

export const logHttp = (message: string, meta?: any) => {
  logger.http(message, meta)
}

export default logger