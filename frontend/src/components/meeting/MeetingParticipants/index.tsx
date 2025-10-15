import React, { useState, useEffect } from 'react'
import { Card, List, Avatar, Button, Typography, Space, Tag, Modal, Input, Select, message } from 'antd'
import {
  UserOutlined,
  PlusOutlined,
  MailOutlined,
  DeleteOutlined,
  CrownOutlined,
  TeamOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { Participant } from '@/types'

const { Title, Text } = Typography
const { Option } = Select

interface MeetingParticipantsProps {
  meetingId: string
}

export const MeetingParticipants: React.FC<MeetingParticipantsProps> = ({ meetingId }) => {
  const {
    currentMeeting,
    addParticipant,
    removeParticipant,
    updateParticipant,
    loading
  } = useMeetingStore()
  const { showSuccess, showError } = useNotification()

  const [isAddModalVisible, setIsAddModalVisible] = useState(false)
  const [newParticipantEmail, setNewParticipantEmail] = useState('')
  const [newParticipantRole, setNewParticipantRole] = useState<'participant' | 'moderator'>('participant')

  const participants = currentMeeting?.participants || []

  // 添加参与者
  const handleAddParticipant = async () => {
    if (!newParticipantEmail.trim()) {
      showError('请输入参与者邮箱')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newParticipantEmail.trim())) {
      showError('请输入有效的邮箱地址')
      return
    }

    try {
      await addParticipant(meetingId, {
        email: newParticipantEmail.trim(),
        role: newParticipantRole,
        name: newParticipantEmail.split('@')[0] // 使用邮箱前缀作为默认名称
      })

      showSuccess('参与者已添加')
      setIsAddModalVisible(false)
      setNewParticipantEmail('')
      setNewParticipantRole('participant')
    } catch (error: any) {
      showError(error.message || '添加参与者失败')
    }
  }

  // 移除参与者
  const handleRemoveParticipant = (participantId: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '确定要移除该参与者吗？',
      onOk: async () => {
        try {
          await removeParticipant(meetingId, participantId)
          showSuccess('参与者已移除')
        } catch (error: any) {
          showError(error.message || '移除参与者失败')
        }
      }
    })
  }

  // 更新参与者角色
  const handleUpdateRole = async (participantId: string, newRole: 'participant' | 'moderator') => {
    try {
      await updateParticipant(meetingId, participantId, { role: newRole })
      showSuccess('角色已更新')
    } catch (error: any) {
      showError(error.message || '更新角色失败')
    }
  }

  // 获取角色颜色
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'host': return 'red'
      case 'moderator': return 'orange'
      case 'participant': return 'blue'
      default: return 'default'
    }
  }

  // 获取角色文本
  const getRoleText = (role: string) => {
    switch (role) {
      case 'host': return '主持人'
      case 'moderator': return '协作者'
      case 'participant': return '参与者'
      default: return '未知'
    }
  }

  // 获取用户头像颜色
  const getAvatarColor = (name: string) => {
    const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068', '#108ee9']
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="space-y-4">
      {/* 参与者头部 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <TeamOutlined className="text-blue-500" />
          <Title level={4} className="mb-0">
            参与者 ({participants.length})
          </Title>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setIsAddModalVisible(true)}
        >
          添加
        </Button>
      </div>

      {/* 参与者列表 */}
      <Card size="small">
        {participants.length === 0 ? (
          <div className="text-center py-6">
            <UserOutlined className="text-3xl text-gray-300 mb-2" />
            <Text type="secondary">暂无参与者</Text>
            <div className="mt-3">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsAddModalVisible(true)}
                size="small"
              >
                添加第一个参与者
              </Button>
            </div>
          </div>
        ) : (
          <List
            size="small"
            dataSource={participants}
            renderItem={(participant, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <List.Item
                  className="py-2"
                  actions={[
                    <Select
                      value={participant.role}
                      size="small"
                      style={{ width: 80 }}
                      onChange={(value) => handleUpdateRole(participant.id, value)}
                      disabled={participant.role === 'host'}
                    >
                      <Option value="participant">参与者</Option>
                      <Option value="moderator">协作者</Option>
                    </Select>,
                    participant.role !== 'host' ? (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        onClick={() => handleRemoveParticipant(participant.id)}
                      />
                    ) : null
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size="small"
                        icon={<UserOutlined />}
                        style={{ backgroundColor: getAvatarColor(participant.name || participant.email) }}
                      >
                        {(participant.name || participant.email).charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    title={
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {participant.name || participant.email}
                        </span>
                        {participant.role === 'host' && (
                          <CrownOutlined className="text-yellow-500 text-xs" />
                        )}
                        <Tag
                          color={getRoleColor(participant.role)}
                          size="small"
                        >
                          {getRoleText(participant.role)}
                        </Tag>
                      </div>
                    }
                    description={
                      <div className="text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <MailOutlined />
                          <span>{participant.email}</span>
                        </div>
                        {participant.joinedAt && (
                          <div>
                            加入时间: {new Date(participant.joinedAt).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              </motion.div>
            )}
          />
        )}
      </Card>

      {/* 添加参与者模态框 */}
      <Modal
        title="添加参与者"
        open={isAddModalVisible}
        onOk={handleAddParticipant}
        onCancel={() => {
          setIsAddModalVisible(false)
          setNewParticipantEmail('')
          setNewParticipantRole('participant')
        }}
        okText="添加"
        cancelText="取消"
        confirmLoading={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              邮箱地址 *
            </label>
            <Input
              type="email"
              placeholder="请输入参与者邮箱"
              value={newParticipantEmail}
              onChange={(e) => setNewParticipantEmail(e.target.value)}
              prefix={<MailOutlined />}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              角色
            </label>
            <Select
              value={newParticipantRole}
              onChange={setNewParticipantRole}
              style={{ width: '100%' }}
            >
              <Option value="participant">参与者</Option>
              <Option value="moderator">协作者</Option>
            </Select>
            <Text type="secondary" className="text-xs mt-1">
              参与者可以查看会议内容和参与讨论，协作者还可以管理会议设置
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  )
}