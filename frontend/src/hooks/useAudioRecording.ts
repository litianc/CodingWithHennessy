import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioRecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  audioBlob: Blob | null
  stream: MediaStream | null
  error: string | null
}

interface UseAudioRecordingOptions {
  sampleRate?: number
  channelCount?: number
  mimeType?: string
  onAudioLevel?: (level: number) => void
  onDurationUpdate?: (duration: number) => void
}

export const useAudioRecording = (options: UseAudioRecordingOptions = {}) => {
  const {
    sampleRate = 16000,
    channelCount = 1,
    mimeType = 'audio/webm',
    onAudioLevel,
    onDurationUpdate
  } = options

  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    audioBlob: null,
    stream: null,
    error: null
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<NodeJS.Timeout>()

  // 音频级别检测
  const detectAudioLevel = useCallback(() => {
    if (!analyserRef.current || !streamRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    // 计算平均音频级别
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length
    const normalizedLevel = Math.min(100, (average / 255) * 100 * 2)

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }))
    onAudioLevel?.(normalizedLevel)

    animationFrameRef.current = requestAnimationFrame(detectAudioLevel)
  }, [onAudioLevel])

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream

      // 创建音频分析器
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setState(prev => ({ ...prev, audioBlob }))
      }

      // 开始录音
      mediaRecorder.start(1000) // 每1秒生成一个数据块
      startTimeRef.current = Date.now()

      // 开始检测音频级别
      detectAudioLevel()

      // 开始更新录音时长
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setState(prev => ({ ...prev, duration }))
        onDurationUpdate?.(duration)
      }, 1000)

      setState({
        isRecording: true,
        isPaused: false,
        stream,
        error: null
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '录音失败'
      setState(prev => ({ ...prev, error: errorMessage }))
    }
  }, [sampleRate, channelCount, mimeType, detectAudioLevel, onDurationUpdate])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      audioLevel: 0
    }))
  }, [state.isRecording])

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause()
      setState(prev => ({ ...prev, isPaused: true }))

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [state.isRecording, state.isPaused])

  // 恢复录音
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume()
      setState(prev => ({ ...prev, isPaused: false }))

      // 重新开始更新时长
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setState(prev => ({ ...prev, duration }))
        onDurationUpdate?.(duration)
      }, 1000)
    }
  }, [state.isRecording, state.isPaused, onDurationUpdate])

  // 获取音频URL
  const getAudioUrl = useCallback(() => {
    if (state.audioBlob) {
      return URL.createObjectURL(state.audioBlob)
    }
    return null
  }, [state.audioBlob])

  // 清理资源
  const cleanup = useCallback(() => {
    if (state.isRecording) {
      stopRecording()
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }, [state.isRecording, stopRecording])

  // 组件卸载时清理资源
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // 重置状态
  const reset = useCallback(() => {
    cleanup()
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
      audioBlob: null,
      stream: null,
      error: null
    })
  }, [cleanup])

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    audioLevel: state.audioLevel,
    audioBlob: state.audioBlob,
    error: state.error,
    stream: state.stream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getAudioUrl,
    reset
  }
}