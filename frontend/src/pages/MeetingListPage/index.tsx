import React, { useState, useEffect } from 'react'
import { Card, List, Button, Typography, Space, Tag, Badge, Tooltip, Empty, Modal, Input, Select, DatePicker, message } from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { Meeting } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input
const { RangePicker } = DatePicker

export const MeetingListPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { meetings, loading, fetchMeetings, createMeeting, deleteMeeting } = useMeetingStore()
  const { showSuccess, showError } = useNotification()

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingDescription, setNewMeetingDescription] = useState('')

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  // 过滤会议
  const filteredMeetings = meetings.filter(meeting => {
    // 搜索过滤
    if (searchText && !meeting.title.toLowerCase().includes(searchText.toLowerCase())) {
      return false
    }

    // 状态过滤
    if (statusFilter !== 'all' && meeting.status !== statusFilter) {
      return false
    }

    // 日期过滤
    if (dateRange) {
      const meetingDate = dayjs(meeting.createdAt)
      if (meetingDate.isBefore(dateRange[0]) || meetingDate.isAfter(dateRange[1])) {
        return false
      }
    }

    return true
  })

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

  // 创建新会议
  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      showError('请输入会议标题')
      return
    }

    try {
      await createMeeting({
        title: newMeetingTitle.trim(),
        description: newMeetingDescription.trim(),
        scheduledTime: dayjs().add(1, 'hour').toISOString()
      })

      showSuccess('会议创建成功')
      setIsCreateModalVisible(false)
      setNewMeetingTitle('')
      setNewMeetingDescription('')
      fetchMeetings()
    } catch (error: any) {
      showError(error.message || '创建会议失败')
    }
  }

  // 删除会议
  const handleDeleteMeeting = (meetingId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后将无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteMeeting(meetingId)
          showSuccess('会议已删除')
          fetchMeetings()
        } catch (error: any) {
          showError(error.message || '删除会议失败')
        }
      }
    })
  }

  // 进入会议
  const handleEnterMeeting = (meeting: Meeting) => {
    navigate(`/meeting/${meeting._id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Title level={2} className="mb-2">
                会议列表
              </Title>
              <Text type="secondary">
                管理和查看所有会议
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalVisible(true)}
              size="large"
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
              创建会议
            </Button>
          </div>
        </div>

        {/* 搜索和过滤器 */}
        <Card className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Search
                placeholder="搜索会议标题..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
              />
            </div>
            <div className="flex gap-4">
              <Select
                placeholder="状态筛选"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                suffixIcon={<FilterOutlined />}
              >
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="scheduled">已安排</Select.Option>
                <Select.Option value="in_progress">进行中</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
                <Select.Option value="cancelled">已取消</Select.Option>
              </Select>
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                value={dateRange}
                onChange={setDateRange}
                format="YYYY-MM-DD"
              />
            </div>
          </div>
        </Card>

        {/* 会议列表 */}
        <Card>
          {filteredMeetings.length === 0 ? (
            <Empty
              description="暂无会议"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalVisible(true)}
              >
                创建第一个会议
              </Button>
            </Empty>
          ) : (
            <List
              dataSource={filteredMeetings}
              renderItem={(meeting, index) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <List.Item
                    className="p-4 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                    actions={[
                      <Tooltip title="查看详情">
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => handleEnterMeeting(meeting)}
                        />
                      </Tooltip>,
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => handleEnterMeeting(meeting)}
                        />
                      </Tooltip>,
                      meeting.status === 'scheduled' || meeting.status === 'cancelled' ? (
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteMeeting(meeting._id)}
                          />
                        </Tooltip>
                      ) : null
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <VideoCameraOutlined className="text-white text-lg" />
                        </div>
                      }
                      title={
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-lg">{meeting.title}</span>
                          <Badge
                            color={getStatusColor(meeting.status)}
                            text={getStatusText(meeting.status)}
                          />
                        </div>
                      }
                      description={
                        <div className="space-y-2">
                          {meeting.description && (
                            <Text type="secondary">{meeting.description}</Text>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <Space size="small">
                              <CalendarOutlined />
                              <span>{dayjs(meeting.scheduledTime).format('YYYY-MM-DD HH:mm')}</span>
                            </Space>
                            <Space size="small">
                              <UserOutlined />
                              <span>{meeting.participants?.length || 0} 位参与者</span>
                            </Space>
                            <Space size="small">
                              <ClockCircleOutlined />
                              <span>创建于 {dayjs(meeting.createdAt).format('MM-DD HH:mm')}</span>
                            </Space>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                </motion.div>
              )}
            />
          )}
        </Card>
      </motion.div>

      {/* 创建会议模态框 */}
      <Modal
        title="创建新会议"
        open={isCreateModalVisible}
        onOk={handleCreateMeeting}
        onCancel={() => {
          setIsCreateModalVisible(false)
          setNewMeetingTitle('')
          setNewMeetingDescription('')
        }}
        okText="创建"
        cancelText="取消"
        confirmLoading={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              会议标题 *
            </label>
            <Input
              placeholder="请输入会议标题"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              会议描述
            </label>
            <Input.TextArea
              placeholder="请输入会议描述（可选）"
              value={newMeetingDescription}
              onChange={(e) => setNewMeetingDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}