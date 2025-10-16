import React, { createContext, useContext, useState, useCallback } from 'react'
import { message, notification } from 'antd'
import { useAuthStore } from '@/stores/authStore'

interface NotificationContextType {
  showSuccess: (message: string, description?: string) => void
  showError: (message: string, description?: string) => void
  showWarning: (message: string, description?: string) => void
  showInfo: (message: string, description?: string) => void
  showLoading: (message: string) => () => void
  notify: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuthStore()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const showSuccess = useCallback((msg: string, description?: string) => {
    message.success(msg, description)
  }, [])

  const showError = useCallback((msg: string, description?: string) => {
    message.error(msg, description, 5)
  }, [])

  const showWarning = useCallback((msg: string, description?: string) => {
    message.warning(msg, description)
  }, [])

  const showInfo = useCallback((msg: string, description?: string) => {
    message.info(msg, description)
  }, [])

  const showLoading = useCallback((msg: string) => {
    const key = `loading-${Date.now()}`
    setLoadingKey(key)
    message.loading({ content: msg, key, duration: 0 })
    return () => {
      message.destroy(key)
      setLoadingKey(null)
    }
  }, [])

  const notify = useCallback((
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    msg: string,
    duration = 4.5
  ) => {
    notification[type]({
      message: title,
      description: msg,
      duration,
      placement: 'topRight',
      className: user ? `notification-${type}` : ''
    })
  }, [user])

  return (
    <NotificationContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showLoading,
        notify
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// 全局错误边界
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { state: { hasError: boolean; error?: Error } }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md mx-4">
            <h2 className="text-2xl font-bold text-red-600 mb-4">出现错误</h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || '应用遇到未知错误'}
            </p>
            <pre className="text-left text-xs bg-gray-100 p-4 rounded overflow-auto max-h-40">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// 全局加载状态
export const useLoading = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('加载中...')

  const withLoading = useCallback(async <T,>(
    asyncFunction: () => Promise<T>,
    text?: string
  ): Promise<T> => {
      setIsLoading(true)
      if (text) setLoadingText(text)
      try {
        const result = await asyncFunction()
        return result
      } finally {
        setIsLoading(false)
        setLoadingText('加载中...')
      }
    }, [])

  return {
    isLoading,
    loadingText,
    withLoading,
    setIsLoading,
    setLoadingText
  }
}

// 网络错误处理
export const useErrorHandler = () => {
  const showError = useNotification().showError

  const handleError = useCallback((error: any) => {
    console.error('Application error:', error)

    let errorMessage = '操作失败'

    if (error?.response) {
      errorMessage = error.response.data?.message || error.message || '服务器错误'
    } else if (error?.message) {
      errorMessage = error.message
    }

    showError(errorMessage)
  }, [showError])

  return { handleError }
}

export default NotificationProvider