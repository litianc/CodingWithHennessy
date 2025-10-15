import React, { useState, useEffect } from 'react'
import { Card, Button, Typography, Space, Badge, Tooltip, Modal, message } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  AudioOutlined,
  UserOutlined,
  ClockCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useMeetingStore } from '@/stores/meetingStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAudioRecording } from '@/hooks/useAudioRecording'
import { Meeting, Participant } from '@/types'

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
  const { socket, isConnected } = useWebSocket()
  const { currentMeeting, updateMeeting, isRecording, setRecording } = useMeetingStore()

  const {
    isRecording: isAudioRecording,
    duration: recordingDuration,
    audioLevel,
    startRecording,
    stopRecording,
    getAudioUrl
  } = useAudioRecording({
    onAudioLevel: (level) => {
      // 处理音频级别变化
    },
    onDurationUpdate: (duration) => {
      // 处理录音时长更新
    }
  })

  const currentMeetingData = meeting || currentMeeting

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

  // 停止录音
  const handleStopRecording = async () => {
    if (!currentMeetingData) return

    try {
      stopRecording()
      setRecording(false)

      // 通知服务器停止录音
      socket?.emit('stop-recording', { meetingId: currentMeetingData._id })

      message.success('录音已停止')
    } catch (error) {
      message.error('停止录音失败')
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
        <div className="flex justify-center space-x-4">
          {currentMeetingData.status === 'scheduled' && (
            <>
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
              >
                加入会议
              </Button>
            </>
          )}

          {currentMeetingData.status === 'in_progress' && (
            <>
              <Tooltip title={isRecording || isAudioRecording ? '停止录音' : '开始录音'}>
                <Button
                  type={isRecording || isAudioRecording ? 'default' : 'primary'}
                  danger={isRecording || isAudioRecording}
                  icon={isRecording || isAudioRecording ? <StopOutlined /> : <AudioOutlined />}
                  onClick={isRecording || isAudioRecording ? handleStopRecording : handleStartRecording}
                  size="large"
                >
                  {isRecording || isAudioRecording ? '停止录音' : '开始录音'}
                </Button>
              </Tooltip>

              <Button
                icon={<StopOutlined />}
                onClick={handleEndMeeting}
                size="large"
              >
                结束会议
              </Button>
            </>
          )}

          {currentMeetingData.status === 'in_progress' && (
            <Button
              onClick={handleLeaveMeeting}
            >
              离开会议
            </Button>
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