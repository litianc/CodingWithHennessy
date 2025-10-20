/**
 * 前端日志工具
 * 将日志输出到浏览器控制台，并可选地发送到后端
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
}

class FrontendLogger {
  private isDevelopment: boolean
  private logBuffer: LogEntry[] = []
  private maxBufferSize: number = 100
  private enableConsole: boolean = true
  private enableBackend: boolean = false

  constructor() {
    this.isDevelopment = import.meta.env.DEV
  }

  private formatTimestamp(): string {
    const now = new Date()
    return now.toISOString().replace('T', ' ').substring(0, 23)
  }

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      message,
      data
    }
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }
  }

  private consoleOutput(entry: LogEntry) {
    if (!this.enableConsole) return

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`
    const message = `${prefix} ${entry.message}`

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data || '')
        break
      case 'info':
        console.info(message, entry.data || '')
        break
      case 'warn':
        console.warn(message, entry.data || '')
        break
      case 'error':
        console.error(message, entry.data || '')
        break
    }
  }

  private async sendToBackend(entry: LogEntry) {
    if (!this.enableBackend) return

    try {
      // 可选：发送到后端日志接口
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'
      await fetch(`${apiBaseUrl}/logs/frontend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      // 静默失败，不影响应用运行
      console.debug('Failed to send log to backend:', error)
    }
  }

  debug(message: string, data?: any) {
    const entry = this.createLogEntry('debug', message, data)
    this.addToBuffer(entry)
    if (this.isDevelopment) {
      this.consoleOutput(entry)
    }
  }

  info(message: string, data?: any) {
    const entry = this.createLogEntry('info', message, data)
    this.addToBuffer(entry)
    this.consoleOutput(entry)
    this.sendToBackend(entry)
  }

  warn(message: string, data?: any) {
    const entry = this.createLogEntry('warn', message, data)
    this.addToBuffer(entry)
    this.consoleOutput(entry)
    this.sendToBackend(entry)
  }

  error(message: string, data?: any) {
    const entry = this.createLogEntry('error', message, data)
    this.addToBuffer(entry)
    this.consoleOutput(entry)
    this.sendToBackend(entry)
  }

  // 获取日志缓冲区
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer]
  }

  // 清空日志缓冲区
  clearBuffer() {
    this.logBuffer = []
  }

  // 导出日志到文件
  exportLogs(): string {
    return this.logBuffer
      .map(entry => `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}${entry.data ? ' ' + JSON.stringify(entry.data) : ''}`)
      .join('\n')
  }

  // 下载日志文件
  downloadLogs() {
    const content = this.exportLogs()
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `frontend-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // 配置选项
  setEnableConsole(enable: boolean) {
    this.enableConsole = enable
  }

  setEnableBackend(enable: boolean) {
    this.enableBackend = enable
  }
}

// 创建单例实例
export const logger = new FrontendLogger()

// 便捷导出方法
export const logDebug = (message: string, data?: any) => logger.debug(message, data)
export const logInfo = (message: string, data?: any) => logger.info(message, data)
export const logWarn = (message: string, data?: any) => logger.warn(message, data)
export const logError = (message: string, data?: any) => logger.error(message, data)

export default logger
