import React, { useState, useEffect } from 'react'
import { Card, Typography, Button, Space, Spin, Empty, Divider, Tag, Modal, message } from 'antd'
import {
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  UserOutlined
} from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { MeetingMinutes as MeetingMinutesType } from '@/types'

const { Title, Text, Paragraph } = Typography

interface MeetingMinutesProps {
  meetingId: string
  editable?: boolean
}

export const MeetingMinutes: React.FC<MeetingMinutesProps> = ({
  meetingId,
  editable = false
}) => {
  const {
    currentMeeting,
    generateMeetingMinutes,
    updateMeetingMinutes,
    loading
  } = useMeetingStore()
  const { showSuccess, showError } = useNotification()

  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedMinutes, setEditedMinutes] = useState<MeetingMinutesType | null>(null)
  const [generationStep, setGenerationStep] = useState(0)

  const minutes = currentMeeting?.minutes

  useEffect(() => {
    if (minutes) {
      setEditedMinutes(minutes)
    }
  }, [minutes])

  // 生成会议纪要
  const handleGenerateMinutes = async () => {
    if (!currentMeeting?.transcriptionSegments || currentMeeting.transcriptionSegments.length === 0) {
      showError('暂无转录内容，无法生成会议纪要')
      return
    }

    setIsGenerating(true)
    setGenerationStep(0)

    try {
      // 模拟三阶段生成过程
      const steps = [
        { delay: 1000, message: 'AI正在分析会议内容...' },
        { delay: 2000, message: '正在搜索相关资料...' },
        { delay: 3000, message: '正在生成会议纪要...' }
      ]

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, steps[i].delay))
        setGenerationStep(i + 1)
      }

      await generateMeetingMinutes(meetingId)
      showSuccess('会议纪要生成成功')
    } catch (error: any) {
      showError(error.message || '生成会议纪要失败')
    } finally {
      setIsGenerating(false)
      setGenerationStep(0)
    }
  }

  // 保存编辑的纪要
  const handleSaveMinutes = async () => {
    if (!editedMinutes) return

    try {
      await updateMeetingMinutes(meetingId, editedMinutes)
      showSuccess('会议纪要已更新')
      setIsEditing(false)
    } catch (error: any) {
      showError(error.message || '更新会议纪要失败')
    }
  }

  // 导出纪要
  const handleExportMinutes = () => {
    if (!minutes) return

    const content = `
会议纪要
====================================

会议标题：${minutes.title}
会议时间：${new Date(minutes.meetingTime).toLocaleString('zh-CN')}
参会人员：${minutes.participants?.join(', ') || '未知'}

主要议题
====================================
${minutes.topics?.map(topic => `- ${topic.title}: ${topic.description}`).join('\n') || '暂无'}

关键决策
====================================
${minutes.decisions?.map(decision => `- ${decision.content} (负责人: ${decision.assignee || '未指定'})`).join('\n') || '暂无'}

行动项目
====================================
${minutes.actionItems?.map(item => `- ${item.content} (负责人: ${item.assignee || '未指定'}, 截止时间: ${item.dueDate || '未设定'})`).join('\n') || '暂无'}

会议总结
====================================
${minutes.summary || '暂无'}

下次会议
====================================
时间：${minutes.nextMeeting?.date || '未设定'}
议题：${minutes.nextMeeting?.topics?.join(', ') || '未设定'}
    `.trim()

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${minutes.title}_会议纪要_${new Date().toLocaleDateString('zh-CN')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    message.success('纪要已导出')
  }

  if (!minutes) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Title level={4} className="mb-0">
            <FileTextOutlined className="mr-2" />
            会议纪要
          </Title>
          <Button
            type="primary"
            icon={<BulbOutlined />}
            onClick={handleGenerateMinutes}
            loading={isGenerating}
            disabled={!currentMeeting?.transcriptionSegments?.length}
          >
            生成纪要
          </Button>
        </div>

        <Empty
          description={
            isGenerating ? (
              <div className="space-y-4">
                <Spin size="large" />
                <div className="text-center space-y-2">
                  <div className="font-medium">AI正在生成会议纪要...</div>
                  <div className="text-sm text-gray-500">
                    {generationStep === 0 && '准备分析会议内容...'}
                    {generationStep === 1 && 'AI正在分析会议内容...'}
                    {generationStep === 2 && '正在搜索相关资料...'}
                    {generationStep === 3 && '正在生成会议纪要...'}
                  </div>
                </div>
              </div>
            ) : (
              '暂无会议纪要，请先完成会议转录'
            )
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 纪要头部 */}
      <div className="flex justify-between items-center">
        <Title level={4} className="mb-0">
          <FileTextOutlined className="mr-2" />
          会议纪要
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleGenerateMinutes}
            loading={isGenerating}
            disabled={isGenerating}
          >
            重新生成
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportMinutes}
          >
            导出
          </Button>
          {editable && !isEditing && (
            <Button
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
            >
              编辑
            </Button>
          )}
          {isEditing && (
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveMinutes}
                loading={loading}
              >
                保存
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setIsEditing(false)
                  setEditedMinutes(minutes)
                }}
              >
                取消
              </Button>
            </Space>
          )}
        </Space>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={isEditing ? 'edit' : 'view'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* 会议基本信息 */}
          <Card size="small">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Text type="secondary" className="text-sm">会议时间</Text>
                <div className="flex items-center mt-1">
                  <ClockCircleOutlined className="mr-1" />
                  <Text>{new Date(minutes.meetingTime).toLocaleString('zh-CN')}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-sm">参会人数</Text>
                <div className="flex items-center mt-1">
                  <UserOutlined className="mr-1" />
                  <Text>{minutes.participants?.length || 0} 人</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-sm">纪要生成时间</Text>
                <div className="flex items-center mt-1">
                  <ClockCircleOutlined className="mr-1" />
                  <Text>{new Date(minutes.generatedAt).toLocaleString('zh-CN')}</Text>
                </div>
              </div>
            </div>
          </Card>

          {/* 参会人员 */}
          {minutes.participants && minutes.participants.length > 0 && (
            <Card size="small" title="参会人员">
              <div className="flex flex-wrap gap-2">
                {minutes.participants.map((participant, index) => (
                  <Tag key={index} color="blue">
                    {participant}
                  </Tag>
                ))}
              </div>
            </Card>
          )}

          {/* 会议总结 */}
          {(isEditing ? editedMinutes?.summary : minutes.summary) && (
            <Card size="small" title="会议总结">
              {isEditing ? (
                <textarea
                  value={editedMinutes?.summary || ''}
                  onChange={(e) => setEditedMinutes(prev => prev ? {
                    ...prev,
                    summary: e.target.value
                  } : null)}
                  className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="请输入会议总结..."
                />
              ) : (
                <Paragraph className="mb-0">
                  {minutes.summary}
                </Paragraph>
              )}
            </Card>
          )}

          {/* 主要议题 */}
          {(isEditing ? editedMinutes?.topics : minutes.topics) && (
            <Card size="small" title="主要议题">
              <div className="space-y-3">
                {(isEditing ? editedMinutes?.topics : minutes.topics)?.map((topic, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <div className="font-medium mb-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={topic.title}
                          onChange={(e) => {
                            const newTopics = [...(editedMinutes?.topics || [])]
                            newTopics[index] = { ...newTopics[index], title: e.target.value }
                            setEditedMinutes(prev => prev ? { ...prev, topics: newTopics } : null)
                          }}
                          className="w-full p-1 border-b border-gray-300 outline-none focus:border-blue-500"
                        />
                      ) : (
                        topic.title
                      )}
                    </div>
                    <Text type="secondary" className="text-sm">
                      {isEditing ? (
                        <textarea
                          value={topic.description}
                          onChange={(e) => {
                            const newTopics = [...(editedMinutes?.topics || [])]
                            newTopics[index] = { ...newTopics[index], description: e.target.value }
                            setEditedMinutes(prev => prev ? { ...prev, topics: newTopics } : null)
                          }}
                          className="w-full p-1 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={2}
                        />
                      ) : (
                        topic.description
                      )}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 关键决策 */}
          {(isEditing ? editedMinutes?.decisions : minutes.decisions) && (
            <Card size="small" title="关键决策">
              <div className="space-y-2">
                {(isEditing ? editedMinutes?.decisions : minutes.decisions)?.map((decision, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <CheckOutlined className="text-green-500 mt-1" />
                    <div className="flex-1">
                      {isEditing ? (
                        <textarea
                          value={decision.content}
                          onChange={(e) => {
                            const newDecisions = [...(editedMinutes?.decisions || [])]
                            newDecisions[index] = { ...newDecisions[index], content: e.target.value }
                            setEditedMinutes(prev => prev ? { ...prev, decisions: newDecisions } : null)
                          }}
                          className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={2}
                        />
                      ) : (
                        <Text>{decision.content}</Text>
                      )}
                      {decision.assignee && (
                        <div className="text-sm text-gray-500 mt-1">
                          负责人: {decision.assignee}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 行动项目 */}
          {(isEditing ? editedMinutes?.actionItems : minutes.actionItems) && (
            <Card size="small" title="行动项目">
              <div className="space-y-3">
                {(isEditing ? editedMinutes?.actionItems : minutes.actionItems)?.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {isEditing ? (
                          <textarea
                            value={item.content}
                            onChange={(e) => {
                              const newActionItems = [...(editedMinutes?.actionItems || [])]
                              newActionItems[index] = { ...newActionItems[index], content: e.target.value }
                              setEditedMinutes(prev => prev ? { ...prev, actionItems: newActionItems } : null)
                            }}
                            className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                            rows={2}
                          />
                        ) : (
                          <Text strong className="block mb-2">{item.content}</Text>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          {item.assignee && (
                            <span>负责人: {item.assignee}</span>
                          )}
                          {item.dueDate && (
                            <span>截止: {item.dueDate}</span>
                          )}
                        </div>
                      </div>
                      <Tag color={item.status === 'completed' ? 'green' : 'orange'}>
                        {item.status === 'completed' ? '已完成' : '进行中'}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 下次会议 */}
          {(isEditing ? editedMinutes?.nextMeeting : minutes.nextMeeting) && (
            <Card size="small" title="下次会议">
              <div className="space-y-2">
                <div>
                  <Text type="secondary" className="text-sm">时间</Text>
                  <div>
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editedMinutes?.nextMeeting?.date || ''}
                        onChange={(e) => {
                          setEditedMinutes(prev => prev ? {
                            ...prev,
                            nextMeeting: {
                              ...prev.nextMeeting,
                              date: e.target.value
                            }
                          } : null)
                        }}
                        className="w-full p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      minutes.nextMeeting?.date || '未设定'
                    )}
                  </div>
                </div>
                <div>
                  <Text type="secondary" className="text-sm">议题</Text>
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedMinutes?.nextMeeting?.topics?.join(', ') || ''}
                        onChange={(e) => {
                          setEditedMinutes(prev => prev ? {
                            ...prev,
                            nextMeeting: {
                              ...prev.nextMeeting,
                              topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            }
                          } : null)
                        }}
                        placeholder="请输入议题，用逗号分隔"
                        className="w-full p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      minutes.nextMeeting?.topics?.join(', ') || '未设定'
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}