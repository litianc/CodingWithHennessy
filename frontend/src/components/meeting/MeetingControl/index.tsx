import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Typography, Space, Badge, Tooltip, Modal, message, Upload, Progress } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  AudioOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  DownloadOutlined,
  FileTextOutlined,
  UploadOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useMeetingStore } from '@/stores/meetingStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAudioRecording } from '@/hooks/useAudioRecording'
import { Meeting, Participant } from '@/types'
import { apiRequest } from '@/services/api'

const { Title, Text } = Typography

interface MeetingControlProps {
  meeting?: Meeting
  onStartMeeting?: () => void
  onEndMeeting?: () => void
  onJoinMeeting?: () => void
  onLeaveMeeting?: () => void
}

export const MeetingControl: React.FC<MeetingControlProps> = ({
  meeting,
  onStartMeeting,
  onEndMeeting,
  onJoinMeeting,
  onLeaveMeeting
}) => {
  const [isSettingsVisible, setIsSettingsVisible] = useState(false)
  const [isStopModalVisible, setIsStopModalVisible] = useState(false)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    duration: number
    size: number
    name: string
    type: string
  } | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [generationStage, setGenerationStage] = useState<'thinking' | 'searching' | 'writing' | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { socket, isConnected } = useWebSocket()
  const { currentMeeting, updateMeeting, isRecording, setRecording } = useMeetingStore()

  const {
    isRecording: isAudioRecording,
    duration: recordingDuration,
    audioLevel,
    audioBlob,
    startRecording,
    stopRecording,
    getAudioUrl
  } = useAudioRecording({
    onAudioLevel: (level) => {
      // 处理音频级别变化
    },
    onDurationUpdate: (duration) => {
      // 实时更新录音时长
    }
  })

  const currentMeetingData = meeting || currentMeeting

  // WebSocket 事件监听 - 会议纪要生成实时反馈
  useEffect(() => {
    if (!socket || !currentMeetingData?._id) return

    const meetingId = currentMeetingData._id

    // 加入会议房间
    socket.emit('join-meeting', meetingId)

    // 监听纪要生成开始事件
    socket.on('minutes-generation-started', (data: any) => {
      console.log('纪要生成开始:', data)
      setGenerationStage('thinking')
      setGenerationProgress(0)
    })

    // 监听三阶段进度事件
    socket.on('minutes-generation-thinking', (data: any) => {
      console.log('AI正在思考...', data)
      setGenerationStage('thinking')
      setGenerationProgress(data.progress || 33)
    })

    socket.on('minutes-generation-searching', (data: any) => {
      console.log('AI正在搜索资料...', data)
      setGenerationStage('searching')
      setGenerationProgress(data.progress || 66)
    })

    socket.on('minutes-generation-writing', (data: any) => {
      console.log('AI正在生成纪要...', data)
      setGenerationStage('writing')
      setGenerationProgress(data.progress || 90)
    })

    // 监听纪要生成完成事件
    socket.on('minutes-generated', (data: any) => {
      console.log('纪要生成完成:', data)
      setGenerationStage(null)
      setGenerationProgress(100)
      message.success('会议纪要生成完成!', 3)

      // 更新会议数据
      if (data.minutes) {
        updateMeeting(meetingId, { minutes: data.minutes })
      }

      // 清空上传的文件
      setUploadedFile(null)
      setUploadedFileInfo(null)
      setIsUploading(false)
    })

    // 监听纪要生成错误事件
    socket.on('minutes-generation-error', (data: any) => {
      console.error('纪要生成失败:', data)
      setGenerationStage(null)
      setGenerationProgress(0)
      setIsUploading(false)
      message.error(data.error || '生成纪要失败')
    })

    // 清理监听器
    return () => {
      socket.off('minutes-generation-started')
      socket.off('minutes-generation-thinking')
      socket.off('minutes-generation-searching')
      socket.off('minutes-generation-writing')
      socket.off('minutes-generated')
      socket.off('minutes-generation-error')
      socket.emit('leave-meeting', meetingId)
    }
  }, [socket, currentMeetingData?._id, updateMeeting])

  // 获取会议状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'blue'
      case 'in_progress': return 'green'
      case 'completed': return 'gray'
      case 'cancelled': return 'red'
      default: return 'gray'
    }
  }

  // 获取会议状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return '已安排'
      case 'in_progress': return '进行中'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      default: return '未知'
    }
  }

  // 开始会议
  const handleStartMeeting = async () => {
    if (!currentMeetingData) return

    try {
      await onStartMeeting?.()
      message.success('会议已开始')
    } catch (error) {
      message.error('开始会议失败')
    }
  }

  // 结束会议
  const handleEndMeeting = async () => {
    if (!currentMeetingData) return

    Modal.confirm({
      title: '确认结束会议',
      content: '结束后，录音和转录将自动保存。',
      onOk: async () => {
        try {
          await onEndMeeting?.()
          if (isAudioRecording) {
            stopRecording()
          }
          message.success('会议已结束')
        } catch (error) {
          message.error('结束会议失败')
        }
      }
    })
  }

  // 加入会议
  const handleJoinMeeting = async () => {
    if (!currentMeetingData) return

    try {
      await onJoinMeeting?.()
      message.success('已加入会议')
    } catch (error) {
      message.error('加入会议失败')
    }
  }

  // 离开会议
  const handleLeaveMeeting = async () => {
    if (!currentMeetingData) return

    Modal.confirm({
      title: '确认离开会议',
      content: '离开后，您将无法接收会议实时更新。',
      onOk: async () => {
        try {
          await onLeaveMeeting?.()
          if (isAudioRecording) {
            stopRecording()
          }
          message.success('已离开会议')
        } catch (error) {
          message.error('离开会议失败')
        }
      }
    })
  }

  // 开始录音
  const handleStartRecording = async () => {
    if (!currentMeetingData) return

    try {
      startRecording()
      setRecording(true)

      // 通知服务器开始录音
      socket?.emit('start-recording', { meetingId: currentMeetingData._id })

      message.success('录音已开始')
    } catch (error) {
      message.error('开始录音失败')
    }
  }

  // 停止录音并显示操作弹窗
  const handleStopRecording = async () => {
    if (!currentMeetingData) return

    try {
      stopRecording()
      setRecording(false)

      // 通知服务器停止录音
      socket?.emit('stop-recording', { meetingId: currentMeetingData._id })

      // 保存录音blob
      if (audioBlob) {
        setRecordingBlob(audioBlob)
      }

      // 显示操作弹窗
      setIsStopModalVisible(true)

      message.success('录音已停止')
    } catch (error) {
      message.error('停止录音失败')
    }
  }

  // 下载录音文件
  const handleDownloadRecording = () => {
    // 优先使用上传的文件，其次是录音blob
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile)
      const a = document.createElement('a')
      a.href = url
      a.download = uploadedFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('音频文件已下载')
      return
    }

    if (!recordingBlob && !audioBlob) {
      message.error('没有可下载的录音文件')
      return
    }

    const blob = recordingBlob || audioBlob
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-${currentMeetingData?._id}-${new Date().getTime()}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    message.success('录音文件已下载')
  }

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    // 验证文件类型
    const acceptedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a']
    const acceptedExtensions = ['.mp3', '.wav', '.webm', '.ogg', '.m4a']

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidType = acceptedTypes.includes(file.type) || acceptedExtensions.includes(fileExtension)

    if (!isValidType) {
      message.error('不支持的文件格式！请上传 MP3, WAV, WebM, OGG 或 M4A 格式的音频文件')
      return false
    }

    // 验证文件大小（限制为100MB）
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      message.error('文件大小超过限制！最大支持 100MB')
      return false
    }

    try {
      // 获取音频时长
      const duration = await getAudioDuration(file)

      setUploadedFile(file)
      setUploadedFileInfo({
        duration: Math.floor(duration),
        size: file.size,
        name: file.name,
        type: file.type || 'audio/' + fileExtension.slice(1)
      })

      // 显示操作弹窗
      setIsStopModalVisible(true)
      message.success('音频文件上传成功！')
    } catch (error) {
      message.error('读取音频文件失败')
    }

    return false // 阻止自动上传
  }

  // 获取音频文件时长
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const url = URL.createObjectURL(file)

      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url)
        resolve(audio.duration)
      })

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        reject(new Error('无法读取音频文件'))
      })

      audio.src = url
    })
  }

  // 生成会议纪要
  const handleGenerateMinutes = async () => {
    if (!currentMeetingData) return

    // 获取音频源
    const audioSource = uploadedFile || recordingBlob || audioBlob
    if (!audioSource) {
      message.error('没有可用的音频文件')
      return
    }

    try {
      setIsStopModalVisible(false)
      setIsUploading(true)
      setUploadProgress(0)
      setGenerationStage('thinking')
      setGenerationProgress(0)

      // 显示上传进度提示
      const uploadMessage = message.loading('正在上传音频文件...', 0)

      // 调用后端API上传音频并生成纪要
      const response = await apiRequest.uploadAudioForMinutes(
        currentMeetingData._id,
        audioSource,
        true, // 自动生成纪要
        (progress) => {
          setUploadProgress(progress)
          if (progress >= 100) {
            uploadMessage()
            message.loading('上传完成，AI正在分析会议内容...', 0)
          }
        }
      )

      console.log('音频上传响应:', response)

      // 注意: 实际的纪要生成完成会通过 WebSocket 事件通知
      // 这里只处理上传成功的反馈
      if (response.success) {
        message.destroy()
        message.info('音频已上传，AI正在分析中...', 3)

        // 如果响应中包含转录内容，可以先更新
        if (response.data.transcriptions) {
          updateMeeting(currentMeetingData._id, {
            transcriptions: response.data.transcriptions
          })
        }
      }
    } catch (error: any) {
      console.error('生成纪要失败:', error)
      message.destroy()
      setIsUploading(false)
      setGenerationStage(null)
      setUploadProgress(0)

      const errorMessage = error.response?.data?.message || error.message || '生成纪要失败'
      message.error(errorMessage)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!currentMeetingData) {
    return (
      <Card className="meeting-control">
        <div className="text-center py-8">
          <Text type="secondary">请选择或创建一个会议</Text>
        </div>
      </Card>
    )
  }

  return (
    <Card className="meeting-control">
      <div className="space-y-4">
        {/* 会议标题和状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Title level={4} className="mb-0">
              {currentMeetingData.title}
            </Title>
            <Badge
              color={getStatusColor(currentMeetingData.status)}
              text={getStatusText(currentMeetingData.status)}
            />
          </div>

          <Button
            icon={<SettingOutlined />}
            onClick={() => setIsSettingsVisible(true)}
            type="text"
          />
        </div>

        {/* 参会者信息 */}
        <div className="flex items-center justify-between">
          <Space>
            <Space size="small">
              <UserOutlined />
              <Text type="secondary">
                {currentMeetingData.participants?.length || 0} 位参与者
              </Text>
            </Space>
            {currentMeetingData.status === 'in_progress' && (
              <Space size="small">
                <ClockCircleOutlined />
                <Text type="secondary">
                  {formatTime(recordingDuration)}
                </Text>
              </Space>
            )}
          </Space>
        </div>

        {/* 音频级别指示器 */}
        {(isRecording || isAudioRecording) && (
          <div className="audio-level-indicator">
            <div className="flex items-center space-x-2">
              <AudioOutlined className="text-red-500" />
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-red-500 h-full rounded-full"
                  style={{ width: `${audioLevel}%` }}
                  animate={{ width: [`${audioLevel}%`, `${audioLevel * 0.8}%`, `${audioLevel}%`] }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <Text type="secondary" className="text-xs">
                {formatTime(recordingDuration)}
              </Text>
            </div>
          </div>
        )}

        {/* 控制按钮 */}
        <div className="flex flex-col items-center space-y-4">
          {currentMeetingData.status === 'scheduled' && (
            <div className="flex space-x-4">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartMeeting}
                size="large"
                disabled={!isConnected}
              >
                开始会议
              </Button>
              <Button
                onClick={handleJoinMeeting}
                disabled={!isConnected}
                type="default"
              >
                加入会议
              </Button>
            </div>
          )}

          {currentMeetingData.status === 'in_progress' && (
            <>
              {/* 主录音按钮 - 强调展示 */}
              <div className="flex flex-col items-center">
                <Tooltip title={isRecording || isAudioRecording ? '停止录音并生成纪要' : '开始本地麦克风录音'}>
                  <Button
                    type="primary"
                    danger={isRecording || isAudioRecording}
                    icon={isRecording || isAudioRecording ? <StopOutlined /> : <AudioOutlined />}
                    onClick={isRecording || isAudioRecording ? handleStopRecording : handleStartRecording}
                    size="large"
                    className={`${isRecording || isAudioRecording ? 'animate-pulse' : ''}`}
                    style={{
                      minWidth: '200px',
                      height: '60px',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}
                  >
                    {isRecording || isAudioRecording ? '⏹ 停止录音' : '🎤 开始录音'}
                  </Button>
                </Tooltip>
                {(isRecording || isAudioRecording) && (
                  <Text type="secondary" className="text-xs mt-2">
                    停止后将自动生成会议纪要
                  </Text>
                )}
              </div>

              {/* 上传音频按钮 */}
              <Upload
                accept=".mp3,.wav,.webm,.ogg,.m4a,audio/*"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                disabled={isRecording || isAudioRecording}
              >
                <Button
                  icon={<UploadOutlined />}
                  size="large"
                  disabled={isRecording || isAudioRecording}
                  style={{
                    minWidth: '200px',
                    height: '50px'
                  }}
                >
                  📁 上传音频文件
                </Button>
              </Upload>

              {/* 次要操作按钮 */}
              <div className="flex space-x-3">
                <Button
                  icon={<StopOutlined />}
                  onClick={handleEndMeeting}
                  size="middle"
                >
                  结束会议
                </Button>
                <Button
                  onClick={handleLeaveMeeting}
                  size="middle"
                  type="text"
                >
                  离开会议
                </Button>
              </div>
            </>
          )}
        </div>

        {/* 连接状态指示器 */}
        <div className="flex justify-center">
          <Space size="small">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Text type="secondary" className="text-xs">
              {isConnected ? '已连接' : '连接断开'}
            </Text>
          </Space>
        </div>
      </div>

      {/* AI生成进度模态框 */}
      <Modal
        title="AI正在生成会议纪要"
        open={isUploading || generationStage !== null}
        closable={false}
        footer={null}
        width={480}
      >
        <div className="space-y-6 py-6">
          {/* 上传进度 */}
          {uploadProgress < 100 && (
            <div className="space-y-2">
              <Text>正在上传音频文件...</Text>
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}

          {/* 三阶段动画进度 */}
          {uploadProgress >= 100 && generationStage && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} spin />

                <div className="text-center">
                  <Title level={4} className="mb-2">
                    {generationStage === 'thinking' && '🤔 AI正在思考分析...'}
                    {generationStage === 'searching' && '🔍 正在搜索相关资料...'}
                    {generationStage === 'writing' && '✍️ 正在生成会议纪要...'}
                  </Title>
                  <Text type="secondary">
                    {generationStage === 'thinking' && '分析会议内容和关键信息'}
                    {generationStage === 'searching' && '查找相关背景和上下文'}
                    {generationStage === 'writing' && '整理并撰写结构化纪要'}
                  </Text>
                </div>

                <Progress
                  percent={generationProgress}
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 停止录音操作弹窗 */}
      <Modal
        title={uploadedFile ? "音频文件已上传" : "录音已停止"}
        open={isStopModalVisible}
        onCancel={() => {
          setIsStopModalVisible(false)
          setUploadedFile(null)
          setUploadedFileInfo(null)
        }}
        footer={null}
        width={480}
      >
        <div className="space-y-6 py-4">
          {/* 录音/上传文件信息 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <Space direction="vertical" size="middle" className="w-full">
              {uploadedFileInfo && (
                <div className="flex items-center justify-between">
                  <Text strong>文件名:</Text>
                  <Text className="text-sm truncate max-w-xs" title={uploadedFileInfo.name}>
                    {uploadedFileInfo.name}
                  </Text>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Text strong>{uploadedFile ? '音频时长:' : '录音时长:'}</Text>
                <Text className="text-lg">
                  {formatTime(uploadedFileInfo?.duration || recordingDuration)}
                </Text>
              </div>
              <div className="flex items-center justify-between">
                <Text strong>音频格式:</Text>
                <Text>
                  {uploadedFileInfo
                    ? uploadedFileInfo.type.split('/')[1]?.toUpperCase() || 'Audio'
                    : 'MP3 Audio'}
                </Text>
              </div>
              <div className="flex items-center justify-between">
                <Text strong>文件大小:</Text>
                <Text>
                  {uploadedFileInfo
                    ? `${(uploadedFileInfo.size / 1024 / 1024).toFixed(2)} MB`
                    : recordingBlob
                      ? `${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`
                      : audioBlob
                        ? `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`
                        : '计算中...'}
                </Text>
              </div>
            </Space>
          </div>

          {/* 操作提示 */}
          <div className="text-center">
            <Text type="secondary">
              请选择下一步操作：下载录音文件或生成会议纪要
            </Text>
          </div>

          {/* 操作按钮 */}
          <Space direction="vertical" size="middle" className="w-full">
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              size="large"
              block
              onClick={handleGenerateMinutes}
            >
              生成会议纪要
            </Button>
            <Button
              icon={<DownloadOutlined />}
              size="large"
              block
              onClick={handleDownloadRecording}
            >
              下载录音文件
            </Button>
            <Button
              size="middle"
              block
              onClick={() => setIsStopModalVisible(false)}
            >
              稍后处理
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 设置模态框 */}
      <Modal
        title="会议设置"
        open={isSettingsVisible}
        onCancel={() => setIsSettingsVisible(false)}
        footer={null}
      >
        <div className="space-y-4">
          {/* 会议设置内容 */}
          <Text>会议设置功能开发中...</Text>
        </div>
      </Modal>
    </Card>
  )
}