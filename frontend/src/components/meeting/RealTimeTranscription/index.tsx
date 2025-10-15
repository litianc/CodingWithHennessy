import React, { useState, useEffect, useRef } from 'react'
import { Card, Typography, Avatar, Space, Spin, Empty, Button, Tooltip } from 'antd'
import {
  UserOutlined,
  SoundOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useMeetingStore } from '@/stores/meetingStore'
import { TranscriptionSegment } from '@/types'

const { Text, Paragraph } = Typography

interface RealTimeTranscriptionProps {
  meetingId: string
  editable?: boolean
  maxHeight?: number
}

interface TranscriptionItemProps {
  segment: TranscriptionSegment
  onEdit?: (segmentId: string, content: string) => void
  onDelete?: (segmentId: string) => void
  isEditing?: boolean
  onToggleEdit?: (segmentId: string) => void
}

const TranscriptionItem: React.FC<TranscriptionItemProps> = ({
  segment,
  onEdit,
  onDelete,
  isEditing = false,
  onToggleEdit
}) => {
  const [editContent, setEditContent] = useState(segment.content)
  const editInputRef = useRef<any>(null)

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = () => {
    if (onEdit && editContent.trim() !== segment.content) {
      onEdit(segment.id, editContent.trim())
    }
    onToggleEdit?.(segment.id)
  }

  const handleCancel = () => {
    setEditContent(segment.content)
    onToggleEdit?.(segment.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="transcription-item"
    >
      <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
        <Avatar
          size="small"
          icon={<UserOutlined />}
          style={{
            backgroundColor: getSpeakerColor(segment.speakerId)
          }}
        >
          {segment.speakerName?.charAt(0).toUpperCase()}
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <Text strong className="text-sm">
              {segment.speakerName}
            </Text>
            <Space size="small">
              <Text type="secondary" className="text-xs">
                {formatTime(segment.startTime)}
              </Text>
              <Tooltip title={`置信度: ${Math.round(segment.confidence * 100)}%`}>
                <SoundOutlined className="text-xs" />
              </Tooltip>
            </Space>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="请输入转录内容..."
              />
              <Space size="small">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleSave}
                >
                  保存
                </Button>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancel}
                >
                  取消
                </Button>
              </Space>
            </div>
          ) : (
            <Paragraph
              className="mb-0 text-gray-700"
              editable={editable ? {
                editing: isEditing,
                onChange: (text) => setEditContent(text),
                onToggle: () => onToggleEdit?.(segment.id),
                onEnd: () => {
                  if (editContent.trim() !== segment.content) {
                    handleSave()
                  }
                }
              } : undefined}
            >
              {segment.content}
            </Paragraph>
          )}
        </div>

        {editable && !isEditing && (
          <Space size="small">
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onToggleEdit?.(segment.id)}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete?.(segment.id)}
              />
            </Tooltip>
          </Space>
        )}
      </div>
    </motion.div>
  )
}

// 说话人颜色映射
const speakerColors = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa541c', '#a0d911', '#2f54eb'
]

const getSpeakerColor = (speakerId: string): string => {
  let hash = 0
  for (let i = 0; i < speakerId.length; i++) {
    hash = speakerId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return speakerColors[Math.abs(hash) % speakerColors.length]
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  meetingId,
  editable = false,
  maxHeight = 400
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [editingSegments, setEditingSegments] = useState<Set<string>>(new Set())
  const { socket } = useWebSocket()
  const { transcriptionSegments, addTranscriptionSegment, updateTranscriptionSegment } = useMeetingStore()
  const containerRef = useRef<HTMLDivElement>(null)

  // 处理实时转录事件
  useEffect(() => {
    if (!socket) return

    // 开始转录
    const handleTranscriptionStarted = () => {
      setIsTranscribing(true)
    }

    // 中间结果
    const handleTranscriptionIntermediate = (data: any) => {
      // 可以显示中间结果，但通常不保存
    }

    // 转录完成
    const handleTranscriptionCompleted = (data: any) => {
      const { result } = data
      if (result) {
        addTranscriptionSegment({
          id: `segment_${Date.now()}_${Math.random()}`,
          speakerId: result.speakerId || 'unknown',
          speakerName: result.speakerName || '未知说话人',
          content: result.text,
          timestamp: new Date(),
          confidence: result.confidence || 0,
          startTime: result.startTime || 0,
          endTime: result.endTime || 0
        })
      }
    }

    // 转录会话完成
    const handleTranscriptionSessionCompleted = () => {
      setIsTranscribing(false)
    }

    // 转录错误
    const handleTranscriptionError = (data: any) => {
      console.error('转录错误:', data.error)
      setIsTranscribing(false)
    }

    socket.on('transcription-started', handleTranscriptionStarted)
    socket.on('transcription-intermediate', handleTranscriptionIntermediate)
    socket.on('transcription-completed', handleTranscriptionCompleted)
    socket.on('transcription-session-completed', handleTranscriptionSessionCompleted)
    socket.on('transcription-error', handleTranscriptionError)

    return () => {
      socket.off('transcription-started', handleTranscriptionStarted)
      socket.off('transcription-intermediate', handleTranscriptionIntermediate)
      socket.off('transcription-completed', handleTranscriptionCompleted)
      socket.off('transcription-session-completed', handleTranscriptionSessionCompleted)
      socket.off('transcription-error', handleTranscriptionError)
    }
  }, [socket, addTranscriptionSegment])

  // 编辑处理
  const handleEditSegment = (segmentId: string, content: string) => {
    updateTranscriptionSegment(segmentId, { content })
  }

  const handleDeleteSegment = (segmentId: string) => {
    // 实现删除逻辑
    console.log('删除转录片段:', segmentId)
  }

  const toggleEditSegment = (segmentId: string) => {
    setEditingSegments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId)
      } else {
        newSet.add(segmentId)
      }
      return newSet
    })
  }

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [transcriptionSegments])

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SoundOutlined />
            <span>实时转录</span>
            {isTranscribing && (
              <Spin size="small" />
            )}
          </div>
          <Space>
            <Text type="secondary" className="text-sm">
              {transcriptionSegments.length} 条记录
            </Text>
          </Space>
        </div>
      }
      className="transcription-panel"
    >
      <div
        ref={containerRef}
        className="transcription-content"
        style={{
          maxHeight,
          overflowY: 'auto'
        }}
      >
        {transcriptionSegments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              isTranscribing
                ? '正在聆听...'
                : '暂无转录内容'
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {transcriptionSegments.map((segment) => (
                <TranscriptionItem
                  key={segment.id}
                  segment={segment}
                  editable={editable}
                  isEditing={editingSegments.has(segment.id)}
                  onEdit={handleEditSegment}
                  onDelete={handleDeleteSegment}
                  onToggleEdit={toggleEditSegment}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  )
}