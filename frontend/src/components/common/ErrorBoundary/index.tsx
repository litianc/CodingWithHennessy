import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button } from 'antd'
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })

    // 这里可以添加错误上报逻辑
    this.reportError(error, errorInfo)
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // 发送错误到监控服务
    try {
      console.group('🚨 Error Report')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义的 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认的错误页面
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <Result
            status="error"
            title="页面出现错误"
            subTitle={
              process.env.NODE_ENV === 'development' ? (
                <div className="mt-4">
                  <p className="text-red-600 font-mono text-sm mb-2">
                    {this.state.error?.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-left">
                      <summary className="cursor-pointer text-gray-600">
                        查看错误详情
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-48">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                '抱歉，页面遇到了一些问题。请刷新页面重试，或返回首页。'
              )
            }
            extra={[
              <Button
                type="primary"
                key="retry"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                重试
              </Button>,
              <Button
                key="home"
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
              >
                返回首页
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary