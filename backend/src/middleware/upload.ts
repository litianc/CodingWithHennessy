// @ts-nocheck
import multer from 'multer'
import path from 'path'
import { Request } from 'express'

// 配置存储
const storage = multer.memoryStorage()

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 检查MIME类型
  const allowedMimeTypes = [
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm',
    'audio/mp4',
    'application/octet-stream' // 允许未知MIME类型，后续通过扩展名检查
  ]

  // 获取文件扩展名
  const ext = path.extname(file.originalname).toLowerCase()
  const allowedExtensions = ['.wav', '.mp3', '.ogg', '.aac', '.flac', '.m4a', '.webm']

  // 检查MIME类型或文件扩展名
  const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype)
  const isExtensionAllowed = allowedExtensions.includes(ext)

  if (isMimeTypeAllowed || isExtensionAllowed) {
    cb(null, true)
  } else {
    cb(new Error(`不支持的文件格式。MIME类型: ${file.mimetype}, 扩展名: ${ext}。支持的格式: wav, mp3, ogg, aac, flac, m4a, webm`))
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