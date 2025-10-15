// @ts-nocheck
import multer from 'multer'
import path from 'path'
import { Request } from 'express'

// 配置存储
const storage = multer.memoryStorage()

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 检查文件类型
  const allowedTypes = [
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a'
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('只支持音频文件格式 (wav, mp3, ogg, aac, flac, m4a)'))
  }
}

// 配置multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
    files: 1 // 每次请求只允许一个文件
  }
})

// 处理音频上传的中间件
export const uploadAudio = upload.single('audio')

// 处理多文件上传的中间件
export const uploadMultipleAudio = upload.array('audios', 10) // 最多10个文件

export { upload }