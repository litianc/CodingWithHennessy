import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Typography, Space, Spin, Empty, Avatar, Tag, Tooltip, Switch } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  ClearOutlined,
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  EditOutlined
} from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { ChatMessage } from '@/types'
import { MinutesEditor } from '../MinutesEditor'

const { TextArea } = Input
const { Text, Paragraph } = Typography

interface AIChatProps {
  meetingId: string
}

interface ChatMessageItemProps {
  message: ChatMessage
  isLast?: boolean
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(({ message, isLast = false }) => {
  const [isLiked, setIsLiked] = useState(false)
  const [isDisliked, setIsDisliked] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    // 这里可以添加复制成功的提示
  }

  const handleLike = () => {
    setIsLiked(!isLiked)
    if (isDisliked) setIsDisliked(false)
  }

  const handleDislike = () => {
    setIsDisliked(!isDisliked)
    if (isLiked) setIsLiked(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="flex-shrink-0 mx-2">
          <Avatar
            icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a'
            }}
          />
        </div>
        <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} flex-1`}>
          <div
            className={`p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {message.role === 'assistant' ? (
              <div className="markdown-content prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <Paragraph className="mb-0 whitespace-pre-wrap text-white">
                {message.content}
              </Paragraph>
            )}
          </div>

          {/* 消息元数据 */}
          <div className="flex items-center mt-1 space-x-2">
            <Text type="secondary" className="text-xs">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>

            {message.role === 'assistant' && (
              <div className="flex items-center space-x-1">
                <Tooltip title="复制">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={handleCopy}
                    className="text-gray-500 hover:text-blue-500"
                  />
                </Tooltip>
                <Tooltip title="有帮助">
                  <Button
                    type="text"
                    size="small"
                    icon={<LikeOutlined />}
                    onClick={handleLike}
                    className={`text-gray-500 hover:text-green-500 ${isLiked ? 'text-green-500' : ''}`}
                  />
                </Tooltip>
                <Tooltip title="没有帮助">
                  <Button
                    type="text"
                    size="small"
                    icon={<DislikeOutlined />}
                    onClick={handleDislike}
                    className={`text-gray-500 hover:text-red-500 ${isDisliked ? 'text-red-500' : ''}`}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export const AIChat: React.FC<AIChatProps> = ({ meetingId }) => {
  // 使用细粒度选择器，只订阅需要的状态
  const currentMeeting = useMeetingStore((state) => state.currentMeeting)
  const messages = useMeetingStore((state) => state.chatHistory[meetingId] || [])
  const sendChatMessage = useMeetingStore((state) => state.sendChatMessage)
  const clearChatHistory = useMeetingStore((state) => state.clearChatHistory)
  const loading = useMeetingStore((state) => state.loading)

  const { showSuccess, showError } = useNotification()

  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<any>(null)

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 快捷建议
  const quickSuggestions = [
    '总结会议要点',
    '列出所有决策',
    '提取行动项目',
    '分析会议效率',
    '优化会议纪要',
    '生成下次会议议程'
  ]

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const message = inputMessage.trim()
    setInputMessage('')
    setIsTyping(true)

    try {
      await sendChatMessage(meetingId, message)
    } catch (error: any) {
      showError(error.message || '发送消息失败')
    } finally {
      setIsTyping(false)
    }
  }

  // 处理快捷建议
  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion)
    textAreaRef.current?.focus()
  }

  // 清空聊天记录
  const handleClearHistory = () => {
    clearChatHistory(meetingId)
    showSuccess('聊天记录已清空')
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 聊天头部 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <RobotOutlined className="text-blue-500" />
          <Text strong>AI 助手</Text>
          {isTyping && (
            <div className="flex items-center space-x-1">
              <Spin size="small" />
              <Text type="secondary" className="text-sm">正在思考...</Text>
            </div>
          )}
        </div>
        <Space>
          <Tooltip title={editMode ? "关闭编辑模式" : "开启编辑模式"}>
            <Space>
              <EditOutlined />
              <Switch
                checked={editMode}
                onChange={setEditMode}
                checkedChildren="编辑"
                unCheckedChildren="聊天"
              />
            </Space>
          </Tooltip>
          <Button
            type="text"
            icon={<ClearOutlined />}
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            size="small"
          >
            清空
          </Button>
        </Space>
      </div>

      {/* 编辑模式 - 纪要编辑器 */}
      {editMode ? (
        <div className="flex-1 overflow-y-auto mb-4">
          {currentMeeting?.minutes ? (
            <MinutesEditor
              meetingId={meetingId}
              minutes={currentMeeting.minutes}
              onSave={() => {
                showSuccess('纪要已保存')
              }}
              onCancel={() => setEditMode(false)}
            />
          ) : (
            <Empty
              description="暂无会议纪要，请先生成纪要"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => setEditMode(false)}>
                返回聊天
              </Button>
            </Empty>
          )}
        </div>
      ) : (
        <>
          {/* 聊天消息区域 */}
          <div className="flex-1 overflow-y-auto mb-4 min-h-[400px]">
            {messages.length === 0 ? (
          <Empty
            description={
              <div className="text-center space-y-4">
                <BulbOutlined className="text-4xl text-gray-300" />
                <div>
                  <Text strong>AI 助手已准备就绪</Text>
                  <div>
                    <Text type="secondary" className="text-sm">
                      我是您的智能会议助手，可以帮助您：
                    </Text>
                  </div>
                  <ul className="text-left text-sm text-gray-500 mt-2 space-y-1">
                    <li>• 总结会议要点</li>
                    <li>• 提取关键决策</li>
                    <li>• 分析会议效率</li>
                    <li>• 优化会议纪要</li>
                  </ul>
                </div>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <div className="space-y-2">
              <Text type="secondary" className="text-sm">试试这些快捷问题：</Text>
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion, index) => (
                  <Tag
                    key={index}
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Tag>
                ))}
              </div>
            </div>
          </Empty>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {messages.map((message, index) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                />
              ))}
            </AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-4"
              >
                <div className="flex max-w-[80%]">
                  <div className="flex-shrink-0 mx-2">
                    <Avatar
                      icon={<RobotOutlined />}
                      style={{ backgroundColor: '#52c41a' }}
                    />
                  </div>
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="flex items-center space-x-1">
                      <Spin size="small" />
                      <Text type="secondary" className="text-sm">正在思考...</Text>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

          {/* 输入区域 */}
          <div className="border-t pt-4">
            <div className="flex space-x-2">
              <TextArea
                ref={textAreaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入您的问题..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || loading}
                className="h-auto"
              >
                发送
              </Button>
            </div>

            {/* 输入提示 */}
            <div className="flex items-center justify-between mt-2">
              <Text type="secondary" className="text-xs">
                按 Enter 发送，Shift + Enter 换行
              </Text>
              {currentMeeting?.transcriptionSegments && currentMeeting.transcriptionSegments.length > 0 && (
                <Tag color="green" size="small">
                  已连接会议转录内容
                </Tag>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}