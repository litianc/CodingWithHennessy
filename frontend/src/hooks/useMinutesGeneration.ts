import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '@/hooks/useSocket'

interface GenerationStage {
  stage: 'thinking' | 'searching' | 'writing' | 'completed'
  progress: number
  message: string
}

interface GeneratedMinutes {
  summary: string
  keyPoints?: string[]
  actionItems?: Array<{
    description: string
    assignee?: string
    dueDate?: string
  }>
  decisions?: string[]
}

interface UseMinutesGenerationReturn {
  isGenerating: boolean
  currentStage: GenerationStage
  generatedMinutes: GeneratedMinutes | null
  error: string | null
  startGeneration: (meetingId: string, transcript: any[]) => void
  resetGeneration: () => void
}

export const useMinutesGeneration = (meetingId: string): UseMinutesGenerationReturn => {
  console.log('🎪 useMinutesGeneration hook 初始化, meetingId:', meetingId)

  const socket = useSocket()
  console.log('🔌 useSocket 返回的 socket:', socket)
  console.log('🔌 socket 状态:', socket ? 'exists' : 'null')
  console.log('🔌 socket.connected:', socket?.connected)

  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStage, setCurrentStage] = useState<GenerationStage>({
    stage: 'thinking',
    progress: 0,
    message: ''
  })
  const [generatedMinutes, setGeneratedMinutes] = useState<GeneratedMinutes | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!socket || !meetingId) return

    console.log('🔌 useMinutesGeneration: 加入会议房间:', meetingId)
    // 加入会议房间，确保能接收 WebSocket 事件
    socket.emit('join-meeting', meetingId)

    // 监听生成开始事件
    socket.on('minutes-generation-started', (data: any) => {
      console.log('📝 纪要生成已开始:', data)
      setIsGenerating(true)
      setError(null)
      setGeneratedMinutes(null)
    })

    // 监听三阶段进度事件
    socket.on('minutes-generation-thinking', (data: any) => {
      console.log('🤔 思考分析:', data)
      setCurrentStage({
        stage: 'thinking',
        progress: data.progress || 33,
        message: data.message || 'AI正在分析会议内容...'
      })
    })

    socket.on('minutes-generation-searching', (data: any) => {
      console.log('🔍 搜索资料:', data)
      setCurrentStage({
        stage: 'searching',
        progress: data.progress || 66,
        message: data.message || '正在搜索相关资料...'
      })
    })

    socket.on('minutes-generation-writing', (data: any) => {
      console.log('✍️ 生成纪要:', data)
      setCurrentStage({
        stage: 'writing',
        progress: data.progress || 90,
        message: data.message || '正在生成会议纪要...'
      })
    })

    // 监听生成完成事件
    socket.on('minutes-generated', (data: any) => {
      console.log('✅ 纪要生成完成:', data)
      console.log('✅ 收到的纪要数据:', data.minutes)

      setCurrentStage({
        stage: 'completed',
        progress: 100,
        message: '会议纪要生成完成！'
      })

      // 先设置生成的纪要数据，再设置 isGenerating 为 false
      setGeneratedMinutes(data.minutes)

      // 延迟设置 isGenerating 为 false，确保 generatedMinutes 先更新
      setTimeout(() => {
        setIsGenerating(false)
      }, 100)
    })

    // 监听错误事件
    socket.on('minutes-generation-error', (data: any) => {
      console.error('❌ 纪要生成错误:', data)
      setError(data.error || '生成会议纪要失败')
      setIsGenerating(false)
    })

    // 清理函数
    return () => {
      console.log('🔌 useMinutesGeneration: 离开会议房间:', meetingId)
      socket.emit('leave-meeting', meetingId)
      socket.off('minutes-generation-started')
      socket.off('minutes-generation-thinking')
      socket.off('minutes-generation-searching')
      socket.off('minutes-generation-writing')
      socket.off('minutes-generated')
      socket.off('minutes-generation-error')
    }
  }, [socket, meetingId])

  const startGeneration = useCallback((meetingId: string, transcript: any[]) => {
    if (!socket) {
      console.error('Socket 未连接')
      return
    }

    console.log('🚀 触发纪要生成:', { meetingId, transcriptLength: transcript.length })

    // 发送生成请求到后端
    socket.emit('generate-minutes', {
      meetingId,
      transcript
    })

    setIsGenerating(true)
    setError(null)
    setCurrentStage({
      stage: 'thinking',
      progress: 0,
      message: '准备分析会议内容...'
    })
  }, [socket])

  const resetGeneration = useCallback(() => {
    setIsGenerating(false)
    setCurrentStage({
      stage: 'thinking',
      progress: 0,
      message: ''
    })
    setGeneratedMinutes(null)
    setError(null)
  }, [])

  return {
    isGenerating,
    currentStage,
    generatedMinutes,
    error,
    startGeneration,
    resetGeneration
  }
}
