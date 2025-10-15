import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tabs, Button, Typography, Space, Divider, Tag, Spin, Alert } from 'antd'
import {
  ArrowLeftOutlined,
  SettingOutlined,
  ShareAltOutlined,
  DownloadOutlined,
  EditOutlined,
  SaveOutlined,
  PauseOutlined,
  StopOutlined,
  AudioOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { MeetingControl } from '@/components/meeting/MeetingControl'
import { RealTimeTranscription } from '@/components/meeting/RealTimeTranscription'
import { MeetingMinutes } from '@/components/meeting/MeetingMinutes'
import { AIChat } from '@/components/meeting/AIChat'
import { MeetingParticipants } from '@/components/meeting/MeetingParticipants'
import { Meeting } from '@/types'

const { Title, Text } = Typography
const { TabPane } = Tabs

export const MeetingDetailPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    currentMeeting,
    loading,
    fetchMeeting,
    updateMeeting,
    startMeeting,
    endMeeting,
    joinMeeting,
    leaveMeeting
  } = useMeetingStore()
  const { showSuccess, showError } = useNotification()

  const [activeTab, setActiveTab] = useState('transcription')
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedDescription, setEditedDescription] = useState('')

  useEffect(() => {
    if (meetingId) {
      fetchMeeting(meetingId)
    }
  }, [meetingId, fetchMeeting])

  useEffect(() => {
    if (currentMeeting) {
      setEditedTitle(currentMeeting.title)
      setEditedDescription(currentMeeting.description || '')
    }
  }, [currentMeeting])

  if (!meetingId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert
          message="会议ID缺失"
          description="请从会议列表页面进入会议详情"
          type="error"
          showIcon
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!currentMeeting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert
          message="会议不存在"
          description="请检查会议ID是否正确"
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/meetings')}>
              返回会议列表
            </Button>
          }
        />
      </div>
    )
  }

  // 保存会议信息
  const handleSaveMeeting = async () => {
    if (!editedTitle.trim()) {
      showError('会议标题不能为空')
      return
    }

    try {
      await updateMeeting(currentMeeting._id, {
        title: editedTitle.trim(),
        description: editedDescription.trim()
      })
      showSuccess('会议信息已更新')
      setIsEditing(false)
    } catch (error: any) {
      showError(error.message || '更新会议信息失败')
    }
  }

  // 开始会议
  const handleStartMeeting = async () => {
    try {
      await startMeeting(currentMeeting._id)
      showSuccess('会议已开始')
    } catch (error: any) {
      showError(error.message || '开始会议失败')
    }
  }

  // 结束会议
  const handleEndMeeting = async () => {
    try {
      await endMeeting(currentMeeting._id)
      showSuccess('会议已结束')
    } catch (error: any) {
      showError(error.message || '结束会议失败')
    }
  }

  // 加入会议
  const handleJoinMeeting = async () => {
    try {
      await joinMeeting(currentMeeting._id)
      showSuccess('已加入会议')
    } catch (error: any) {
      showError(error.message || '加入会议失败')
    }
  }

  // 离开会议
  const handleLeaveMeeting = async () => {
    try {
      await leaveMeeting(currentMeeting._id)
      showSuccess('已离开会议')
    } catch (error: any) {
      showError(error.message || '离开会议失败')
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'blue'
      case 'in_progress': return 'green'
      case 'completed': return 'default'
      case 'cancelled': return 'red'
      default: return 'default'
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return '已安排'
      case 'in_progress': return '进行中'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      default: return '未知'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white shadow-sm border-b"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/meetings')}
                type="text"
              >
                返回
              </Button>
              <Divider type="vertical" />
              <div className="flex items-center space-x-3">
                {isEditing ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-2xl font-bold border-b-2 border-blue-500 outline-none"
                      maxLength={100}
                    />
                    <Button
                      type="text"
                      icon={<SaveOutlined />}
                      onClick={handleSaveMeeting}
                      className="text-green-600"
                    />
                    <Button
                      type="text"
                      onClick={() => {
                        setIsEditing(false)
                        setEditedTitle(currentMeeting.title)
                        setEditedDescription(currentMeeting.description || '')
                      }}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Title level={2} className="mb-0">
                      {currentMeeting.title}
                    </Title>
                    <Tag color={getStatusColor(currentMeeting.status)}>
                      {getStatusText(currentMeeting.status)}
                    </Tag>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setIsEditing(true)}
                      size="small"
                    />
                  </div>
                )}
              </div>
            </div>
            <Space>
              <Button
                icon={<ShareAltOutlined />}
                type="text"
              >
                分享
              </Button>
              <Button
                icon={<DownloadOutlined />}
                type="text"
              >
                导出
              </Button>
              <Button
                icon={<SettingOutlined />}
                type="text"
              >
                设置
              </Button>
            </Space>
          </div>
        </div>
      </motion.div>

      {/* 会议主体内容 */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 会议控制面板 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <MeetingControl
                meeting={currentMeeting}
                onStartMeeting={handleStartMeeting}
                onEndMeeting={handleEndMeeting}
                onJoinMeeting={handleJoinMeeting}
                onLeaveMeeting={handleLeaveMeeting}
              />
            </motion.div>

            {/* 会议描述 */}
            {currentMeeting.description && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card>
                  <Title level={4}>会议描述</Title>
                  <Text>{currentMeeting.description}</Text>
                </Card>
              </motion.div>
            )}

            {/* 标签页内容 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  size="large"
                >
                  <TabPane tab="实时转录" key="transcription">
                    <RealTimeTranscription
                      meetingId={currentMeeting._id}
                      editable={currentMeeting.status === 'completed'}
                    />
                  </TabPane>
                  <TabPane tab="会议纪要" key="minutes">
                    <MeetingMinutes
                      meetingId={currentMeeting._id}
                      editable={currentMeeting.status === 'completed'}
                    />
                  </TabPane>
                  <TabPane tab="AI 助手" key="ai">
                    <AIChat
                      meetingId={currentMeeting._id}
                    />
                  </TabPane>
                </Tabs>
              </Card>
            </motion.div>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6">
            {/* 参与者列表 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <MeetingParticipants
                meetingId={currentMeeting._id}
              />
            </motion.div>

            {/* 会议信息 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card title="会议信息" size="small">
                <div className="space-y-3">
                  <div>
                    <Text type="secondary">创建时间</Text>
                    <div>
                      {new Date(currentMeeting.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary">预计时间</Text>
                    <div>
                      {new Date(currentMeeting.scheduledTime).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary">会议ID</Text>
                    <div className="font-mono text-xs">
                      {currentMeeting._id}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}