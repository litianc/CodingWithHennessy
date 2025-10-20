import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Typography, Avatar, Space, Spin, Empty, Button, Tooltip, Input, Select, Tag, Progress, Dropdown } from 'antd'
import {
  UserOutlined,
  SoundOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  TeamOutlined
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
  editable?: boolean
}

const TranscriptionItem: React.FC<TranscriptionItemProps> = ({
  segment,
  onEdit,
  onDelete,
  isEditing = false,
  onToggleEdit,
  editable = false
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
                <div className="flex items-center space-x-1">
                  <Progress
                    type="circle"
                    percent={Math.round(segment.confidence * 100)}
                    size={20}
                    strokeWidth={8}
                    format={() => ''}
                    strokeColor={
                      segment.confidence >= 0.9 ? '#52c41a' :
                      segment.confidence >= 0.7 ? '#faad14' : '#f5222d'
                    }
                  />
                </div>
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
  const [searchText, setSearchText] = useState('')
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all')
  const { socket } = useWebSocket()

  // 使用细粒度选择器，只订阅需要的状态
  const transcriptionSegments = useMeetingStore((state) => state.transcriptionSegments)
  const addTranscriptionSegment = useMeetingStore((state) => state.addTranscriptionSegment)
  const updateTranscriptionSegment = useMeetingStore((state) => state.updateTranscriptionSegment)
  const clearTranscriptionSegments = useMeetingStore((state) => state.clearTranscriptionSegments)
  const fetchMeeting = useMeetingStore((state) => state.fetchMeeting)
  const containerRef = useRef<HTMLDivElement>(null)

  // 处理实时转录事件
  useEffect(() => {
    if (!socket) return

    // 加入会议room以接收事件
    socket.emit('join-meeting', meetingId)
    console.log('RealTimeTranscription: 已加入会议房间', meetingId)

    // 开始转录
    const handleTranscriptionStarted = () => {
      setIsTranscribing(true)
    }

    // 中间结果
    const handleTranscriptionIntermediate = (data: any) => {
      // 可以显示中间结果，但通常不保存
    }

    // 转录完成（单个转录段，实时转录）
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

    // 文件转录完成（从上传的音频文件转录）
    const handleFileTranscriptionCompleted = async (data: any) => {
      console.log('文件转录完成，清空旧内容并重新加载:', data)
      // 清空现有的转录内容
      clearTranscriptionSegments()
      // 重新加载会议数据，获取最新的转录结果
      try {
        await fetchMeeting(meetingId)
        setIsTranscribing(false)
      } catch (error) {
        console.error('重新加载会议数据失败:', error)
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
    socket.on('transcription-completed', handleFileTranscriptionCompleted)
    socket.on('transcription-segment', handleTranscriptionCompleted)
    socket.on('transcription-session-completed', handleTranscriptionSessionCompleted)
    socket.on('transcription-error', handleTranscriptionError)

    return () => {
      socket.off('transcription-started', handleTranscriptionStarted)
      socket.off('transcription-intermediate', handleTranscriptionIntermediate)
      socket.off('transcription-completed', handleFileTranscriptionCompleted)
      socket.off('transcription-segment', handleTranscriptionCompleted)
      socket.off('transcription-session-completed', handleTranscriptionSessionCompleted)
      socket.off('transcription-error', handleTranscriptionError)
    }
  }, [socket, addTranscriptionSegment, clearTranscriptionSegments, fetchMeeting, meetingId])

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

  // 获取所有说话人列表
  const speakers = useMemo(() => {
    const uniqueSpeakers = Array.from(new Set(transcriptionSegments.map(s => s.speakerName)))
    return uniqueSpeakers
  }, [transcriptionSegments])

  // 筛选转录内容
  const filteredSegments = useMemo(() => {
    return transcriptionSegments.filter(segment => {
      // 说话人筛选
      if (selectedSpeaker !== 'all' && segment.speakerName !== selectedSpeaker) {
        return false
      }
      // 内容搜索
      if (searchText && !segment.content.toLowerCase().includes(searchText.toLowerCase())) {
        return false
      }
      return true
    })
  }, [transcriptionSegments, selectedSpeaker, searchText])

  // 统计信息
  const stats = useMemo(() => {
    const speakerStats = new Map<string, { count: number; totalTime: number; avgConfidence: number }>()

    transcriptionSegments.forEach(segment => {
      const existing = speakerStats.get(segment.speakerName) || { count: 0, totalTime: 0, avgConfidence: 0 }
      speakerStats.set(segment.speakerName, {
        count: existing.count + 1,
        totalTime: existing.totalTime + (segment.endTime - segment.startTime),
        avgConfidence: (existing.avgConfidence * existing.count + segment.confidence) / (existing.count + 1)
      })
    })

    return speakerStats
  }, [transcriptionSegments])

  // 导出转录内容
  const handleExport = () => {
    const content = filteredSegments.map(segment => {
      return `[${formatTime(segment.startTime)}] ${segment.speakerName}: ${segment.content}`
    }).join('\n\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `会议转录_${new Date().toLocaleDateString('zh-CN')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <Card
      title={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SoundOutlined />
              <span>实时转录</span>
              {isTranscribing && (
                <Spin size="small" />
              )}
            </div>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={filteredSegments.length === 0}
                size="small"
              >
                导出
              </Button>
              <Text type="secondary" className="text-sm">
                {filteredSegments.length} / {transcriptionSegments.length} 条记录
              </Text>
            </Space>
          </div>

          {/* 搜索和筛选工具栏 */}
          <div className="flex items-center space-x-2">
            <Input
              placeholder="搜索转录内容..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
              style={{ flex: 1, maxWidth: 300 }}
            />
            <Select
              value={selectedSpeaker}
              onChange={setSelectedSpeaker}
              size="small"
              style={{ width: 120 }}
              suffixIcon={<FilterOutlined />}
            >
              <Select.Option value="all">全部说话人</Select.Option>
              {speakers.map(speaker => (
                <Select.Option key={speaker} value={speaker}>
                  {speaker}
                </Select.Option>
              ))}
            </Select>

            {/* 说话人统计 */}
            {speakers.length > 0 && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: Array.from(stats.entries()).map(([speaker, stat]) => ({
                    key: speaker,
                    label: (
                      <div className="py-1">
                        <div className="font-medium">{speaker}</div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>发言次数: {stat.count}</div>
                          <div>平均置信度: {Math.round(stat.avgConfidence * 100)}%</div>
                        </div>
                      </div>
                    )
                  }))
                }}
              >
                <Button size="small" icon={<TeamOutlined />}>
                  统计
                </Button>
              </Dropdown>
            )}
          </div>
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
        {filteredSegments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              transcriptionSegments.length === 0
                ? (isTranscribing ? '正在聆听...' : '暂无转录内容')
                : '没有匹配的转录内容'
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filteredSegments.map((segment) => (
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