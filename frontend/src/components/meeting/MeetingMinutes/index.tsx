import React, { useState, useEffect } from 'react'
import { Card, Typography, Button, Space, Empty, Divider, Tag, message, Alert } from 'antd'
import {
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CloseOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckOutlined,
  MailOutlined
} from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useMeetingStore } from '@/stores/meetingStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { useMinutesGeneration } from '@/hooks/useMinutesGeneration'
import { GenerationProgress } from './GenerationProgress'
import { EmailSendModal } from '@/components/meeting/EmailSendModal'
import { MeetingMinutes as MeetingMinutesType } from '@/types'
import { apiRequest } from '@/services/api'

const { Title, Text, Paragraph } = Typography

interface MeetingMinutesProps {
  meetingId: string
  editable?: boolean
}

export const MeetingMinutes: React.FC<MeetingMinutesProps> = ({
  meetingId,
  editable = false
}) => {
  console.log('🎬 MeetingMinutes 组件渲染, meetingId:', meetingId)

  // 使用细粒度选择器，只订阅需要的状态
  const currentMeeting = useMeetingStore((state) => state.currentMeeting)
  const updateMeetingMinutes = useMeetingStore((state) => state.updateMeetingMinutes)
  const loading = useMeetingStore((state) => state.loading)
  const { showSuccess, showError } = useNotification()

  console.log('📊 currentMeeting:', currentMeeting)

  // 使用 WebSocket 纪要生成 hook
  console.log('🔌 准备调用 useMinutesGeneration')
  const {
    isGenerating,
    currentStage,
    generatedMinutes,
    error: generationError,
    startGeneration,
    resetGeneration
  } = useMinutesGeneration(meetingId)
  console.log('🔌 useMinutesGeneration 返回:', { isGenerating, startGeneration, resetGeneration })

  const [isEditing, setIsEditing] = useState(false)
  const [editedMinutes, setEditedMinutes] = useState<MeetingMinutesType | null>(null)
  const [minutes, setMinutes] = useState<any>(null)
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false)

  // 当生成完成时，更新 minutes
  useEffect(() => {
    console.log('📊 generatedMinutes 变化:', generatedMinutes)

    if (generatedMinutes) {
      console.log('🔄 开始转换纪要数据格式...')

      // 将 WebSocket 返回的数据转换为组件需要的格式
      const formattedMinutes: any = {
        title: currentMeeting?.title || '会议纪要',
        meetingTime: currentMeeting?.startTime || new Date(),
        participants: currentMeeting?.participants?.map(p => p.name) || [],
        summary: generatedMinutes.summary,
        keyPoints: generatedMinutes.keyPoints?.map((point, index) => ({
          title: `要点 ${index + 1}`,
          description: typeof point === 'string' ? point : point.description || point.title
        })),
        decisions: generatedMinutes.decisions?.map(d => ({
          content: typeof d === 'string' ? d : d.description,
          assignee: typeof d === 'object' ? d.decisionMaker || '' : '',
          context: typeof d === 'object' ? d.context || '' : ''
        })),
        actionItems: generatedMinutes.actionItems?.map(item => ({
          content: typeof item === 'string' ? item : item.description,
          assignee: typeof item === 'object' ? item.assignee || '' : '',
          dueDate: typeof item === 'object' ? item.dueDate || '' : '',
          priority: typeof item === 'object' ? item.priority || 'medium' : 'medium',
          status: 'pending'
        })),
        generatedAt: new Date()
      }

      console.log('✅ 格式化后的纪要数据:', formattedMinutes)

      setMinutes(formattedMinutes)
      setEditedMinutes(formattedMinutes)
      showSuccess('会议纪要生成成功！')
    }
  }, [generatedMinutes, currentMeeting, showSuccess])

  // 初始化已有的 minutes
  useEffect(() => {
    if (currentMeeting?.minutes) {
      // 规范化已有的minutes数据
      const normalizedMinutes: any = {
        ...currentMeeting.minutes,
        title: currentMeeting.minutes.title || currentMeeting.title || '会议纪要',
        meetingTime: currentMeeting.minutes.meetingTime || currentMeeting.startTime || new Date(),
        participants: currentMeeting.minutes.participants || currentMeeting.participants?.map(p => p.name) || [],
        summary: currentMeeting.minutes.summary || '',
        keyPoints: currentMeeting.minutes.keyPoints?.map((point, index) => ({
          title: point.title || `要点 ${index + 1}`,
          description: typeof point === 'string' ? point : point.description || point.title
        })) || [],
        decisions: currentMeeting.minutes.decisions?.map(d => ({
          content: typeof d === 'string' ? d : d.description || d.content,
          assignee: typeof d === 'object' ? (d.decisionMaker || d.assignee || '') : '',
          context: typeof d === 'object' ? d.context || '' : ''
        })) || [],
        actionItems: currentMeeting.minutes.actionItems?.map(item => ({
          content: typeof item === 'string' ? item : item.description || item.content,
          assignee: typeof item === 'object' ? item.assignee || '' : '',
          dueDate: typeof item === 'object' ? item.dueDate || '' : '',
          priority: typeof item === 'object' ? item.priority || 'medium' : 'medium',
          status: typeof item === 'object' ? item.status || 'pending' : 'pending'
        })) || [],
        generatedAt: currentMeeting.minutes.generatedAt || currentMeeting.minutes.createdAt || new Date()
      }
      setMinutes(normalizedMinutes)
      setEditedMinutes(normalizedMinutes)
    }
  }, [currentMeeting?.minutes, currentMeeting?.title, currentMeeting?.startTime, currentMeeting?.participants])

  // 显示生成错误
  useEffect(() => {
    if (generationError) {
      showError(generationError)
    }
  }, [generationError, showError])

  // 生成会议纪要
  const handleGenerateMinutes = () => {
    console.log('🎯 ===== handleGenerateMinutes 被调用 =====')
    console.log('📊 当前会议数据:', currentMeeting)
    console.log('🔌 startGeneration 函数:', startGeneration)
    console.log('🆔 meetingId:', meetingId)

    // 优先使用 transcriptions，如果没有再尝试 transcriptionSegments
    const transcripts = currentMeeting?.transcriptions || currentMeeting?.transcriptionSegments || []

    console.log('📝 转录记录数量:', transcripts.length)
    console.log('📝 转录记录内容:', transcripts)

    if (transcripts.length === 0) {
      console.error('❌ 暂无转录内容')
      showError('暂无转录内容，无法生成会议纪要')
      return
    }

    console.log('🚀 准备触发 startGeneration')
    console.log('🚀 调用参数:', { meetingId, transcriptsLength: transcripts.length })

    // 触发 WebSocket 生成
    startGeneration(meetingId, transcripts)

    console.log('✅ startGeneration 已调用')
  }

  // 保存编辑的纪要
  const handleSaveMinutes = async () => {
    if (!editedMinutes) return

    try {
      await updateMeetingMinutes(meetingId, editedMinutes)
      setMinutes(editedMinutes)
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

会议总结
====================================
${minutes.summary || '暂无'}

关键要点
====================================
${minutes.keyPoints?.map((kp: any, i: number) => `${i + 1}. ${kp.description}`).join('\n') || '暂无'}

关键决策
====================================
${minutes.decisions?.map((d: any, i: number) => `${i + 1}. ${d.content} (负责人: ${d.assignee || '未指定'})`).join('\n') || '暂无'}

行动项目
====================================
${minutes.actionItems?.map((item: any, i: number) => `${i + 1}. ${item.content} (负责人: ${item.assignee || '未指定'}, 截止时间: ${item.dueDate || '未设定'})`).join('\n') || '暂无'}
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

  // 生成邮件预览内容
  const generateEmailPreview = () => {
    if (!minutes) return { subject: '', content: '' }

    const subject = `[会议纪要] ${minutes.title}`

    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">会议纪要</h1>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
          <h2 style="color: #667eea; margin-top: 0;">📋 ${minutes.title}</h2>
          <p style="margin: 5px 0;"><strong>会议时间：</strong>${new Date(minutes.meetingTime).toLocaleString('zh-CN')}</p>
          <p style="margin: 5px 0;"><strong>参会人员：</strong>${minutes.participants?.join(', ') || '未知'}</p>
        </div>

        ${minutes.summary ? `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📝 会议总结</h3>
          <p style="line-height: 1.8; background: #f0f4ff; padding: 15px; border-radius: 5px;">${minutes.summary}</p>
        </div>
        ` : ''}

        ${minutes.keyPoints && minutes.keyPoints.length > 0 ? `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🎯 关键要点</h3>
          <ul style="line-height: 2;">
            ${minutes.keyPoints.map((kp: any) => `
              <li style="margin: 10px 0; padding: 10px; background: #f0f4ff; border-left: 3px solid #667eea;">${kp.description || kp.title}</li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${minutes.decisions && minutes.decisions.length > 0 ? `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">💡 关键决策</h3>
          <ul style="line-height: 2;">
            ${minutes.decisions.map((d: any) => `
              <li style="margin: 10px 0; padding: 10px; background: #fff3e0; border-left: 3px solid #ff9800;">
                <strong>${d.content || d}</strong>
                ${d.assignee ? `<br/><span style="color: #666; font-size: 14px;">负责人: ${d.assignee}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${minutes.actionItems && minutes.actionItems.length > 0 ? `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">✅ 行动项目</h3>
          <ul style="line-height: 2;">
            ${minutes.actionItems.map((item: any) => `
              <li style="margin: 15px 0; padding: 15px; background: #e8f5e9; border-left: 3px solid #4caf50; border-radius: 5px;">
                <strong>${item.content}</strong>
                <div style="margin-top: 8px; font-size: 14px; color: #666;">
                  ${item.assignee ? `👤 负责人: <strong>${item.assignee}</strong>` : ''}
                  ${item.dueDate ? ` | ⏰ 截止时间: <strong>${item.dueDate}</strong>` : ''}
                  ${item.priority ? ` | 优先级: <strong style="color: ${item.priority === 'high' ? '#f44336' : item.priority === 'medium' ? '#ff9800' : '#4caf50'}">${item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}</strong>` : ''}
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 5px; text-align: center; color: #666; font-size: 12px;">
          <p>此邮件由智能会议纪要系统自动生成</p>
          <p>生成时间: ${new Date(minutes.generatedAt).toLocaleString('zh-CN')}</p>
        </div>
      </div>
    `

    return { subject, content }
  }

  // 发送邮件
  const handleSendEmail = async (selectedRecipients: string[], customRecipients?: string[]) => {
    try {
      await apiRequest.sendMeetingMinutes(
        meetingId,
        customRecipients && customRecipients.length > 0 ? customRecipients : undefined
      )
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || '发送邮件失败')
    }
  }

  // 如果正在生成或刚刚完成（completed 状态），显示进度动画
  if (isGenerating || (currentStage.stage === 'completed' && !minutes)) {
    const isCompleted = currentStage.stage === 'completed'

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Title level={4} className="mb-0">
            <FileTextOutlined className="mr-2" />
            会议纪要
          </Title>
        </div>

        <GenerationProgress
          currentStage={currentStage}
          isGenerating={isGenerating || isCompleted}
        />

        <Alert
          message={isCompleted ? "✅ 会议纪要生成完成" : "AI 正在生成会议纪要"}
          description={isCompleted ? "正在加载纪要内容..." : "这个过程可能需要几秒钟，请耐心等待..."}
          type={isCompleted ? "success" : "info"}
          showIcon
        />
      </div>
    )
  }

  // 如果没有纪要，显示空状态
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
            disabled={!(currentMeeting?.transcriptions?.length || currentMeeting?.transcriptionSegments?.length)}
            size="large"
          >
            🤖 AI 生成纪要
          </Button>
        </div>

        <Empty
          description="暂无会议纪要，请先完成会议转录或点击上方按钮生成"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    )
  }

  // 显示已生成的纪要
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
            type="primary"
            icon={<MailOutlined />}
            onClick={() => setIsEmailModalVisible(true)}
            disabled={!currentMeeting?.participants || currentMeeting.participants.length === 0}
          >
            发送邮件
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              resetGeneration()
              handleGenerateMinutes()
            }}
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
          <Card
            size="small"
            className="bg-gradient-to-r from-blue-50 to-purple-50 border-none shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <ClockCircleOutlined className="text-blue-600 text-xl" />
                </div>
                <Text type="secondary" className="text-xs font-medium uppercase tracking-wide">会议时间</Text>
                <Text className="mt-1 font-semibold text-gray-800">{new Date(minutes.meetingTime).toLocaleString('zh-CN')}</Text>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <UserOutlined className="text-green-600 text-xl" />
                </div>
                <Text type="secondary" className="text-xs font-medium uppercase tracking-wide">参会人数</Text>
                <Text className="mt-1 font-semibold text-gray-800">{minutes.participants?.length || 0} 人</Text>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                  <ClockCircleOutlined className="text-purple-600 text-xl" />
                </div>
                <Text type="secondary" className="text-xs font-medium uppercase tracking-wide">纪要生成时间</Text>
                <Text className="mt-1 font-semibold text-gray-800">{new Date(minutes.generatedAt).toLocaleString('zh-CN')}</Text>
              </div>
            </div>
          </Card>

          {/* 参会人员 */}
          {minutes.participants && minutes.participants.length > 0 && (
            <Card size="small" title="📌 参会人员">
              <div className="flex flex-wrap gap-2">
                {minutes.participants.map((participant: string, index: number) => (
                  <Tag key={index} color="blue">
                    {participant}
                  </Tag>
                ))}
              </div>
            </Card>
          )}

          {/* 会议总结 */}
          {minutes.summary && (
            <Card
              size="small"
              title={
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-lg">📝</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">会议总结</span>
                </div>
              }
              className="border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-all duration-300"
            >
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
                <div className="bg-blue-50 p-4 rounded-lg">
                  <Paragraph className="mb-0 text-base leading-relaxed text-gray-700">
                    {minutes.summary}
                  </Paragraph>
                </div>
              )}
            </Card>
          )}

          {/* 关键要点 */}
          {minutes.keyPoints && minutes.keyPoints.length > 0 && (
            <Card
              size="small"
              title={
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-lg">🎯</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">关键要点</span>
                </div>
              }
              className="border-l-4 border-green-500 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <div className="space-y-3">
                {minutes.keyPoints.map((point: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold shadow-md">
                      {index + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <Text className="text-gray-800 leading-relaxed">{point.description || point.title}</Text>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}

          {/* 关键决策 */}
          {minutes.decisions && minutes.decisions.length > 0 && (
            <Card
              size="small"
              title={
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-lg">💡</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">关键决策</span>
                </div>
              }
              className="border-l-4 border-purple-500 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <div className="space-y-3">
                {minutes.decisions.map((decision: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors duration-200 border border-purple-200"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center mt-1">
                      <CheckOutlined className="text-white text-xs" />
                    </div>
                    <div className="flex-1">
                      <Text className="text-gray-800 font-medium">{decision.content || decision}</Text>
                      {decision.assignee && (
                        <div className="flex items-center mt-2 text-sm text-purple-700 bg-purple-100 px-2 py-1 rounded-md inline-block">
                          <UserOutlined className="mr-1" />
                          <span>负责人: {decision.assignee}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}

          {/* 行动项目 */}
          {minutes.actionItems && minutes.actionItems.length > 0 && (
            <Card
              size="small"
              title={
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="text-lg">✅</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">行动项目</span>
                </div>
              }
              className="border-l-4 border-orange-500 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <div className="space-y-4">
                {minutes.actionItems.map((item: any, index: number) => {
                  // 优先级颜色映射
                  const getPriorityColor = (priority: string) => {
                    switch (priority) {
                      case 'high': return 'from-red-400 to-red-600';
                      case 'medium': return 'from-yellow-400 to-yellow-600';
                      case 'low': return 'from-green-400 to-green-600';
                      default: return 'from-gray-400 to-gray-600';
                    }
                  };

                  const getPriorityLabel = (priority: string) => {
                    switch (priority) {
                      case 'high': return '高';
                      case 'medium': return '中';
                      case 'low': return '低';
                      default: return '未设定';
                    }
                  };

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-2 border-orange-200 rounded-xl p-4 bg-gradient-to-r from-orange-50 to-yellow-50 hover:shadow-xl hover:border-orange-300 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getPriorityColor(item.priority)}`} />
                            <Text strong className="text-lg text-gray-900">{item.content}</Text>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {item.assignee && (
                              <div className="flex items-center bg-white px-3 py-1 rounded-full shadow-sm">
                                <UserOutlined className="text-blue-500 mr-1" />
                                <span className="text-sm text-gray-700">{item.assignee}</span>
                              </div>
                            )}
                            {item.dueDate && (
                              <div className="flex items-center bg-white px-3 py-1 rounded-full shadow-sm">
                                <ClockCircleOutlined className="text-purple-500 mr-1" />
                                <span className="text-sm text-gray-700">{item.dueDate}</span>
                              </div>
                            )}
                            <div className={`flex items-center px-3 py-1 rounded-full shadow-sm bg-gradient-to-r ${getPriorityColor(item.priority)}`}>
                              <span className="text-xs font-bold text-white">优先级: {getPriorityLabel(item.priority)}</span>
                            </div>
                          </div>
                        </div>
                        <Tag
                          color={item.status === 'completed' ? 'success' : 'processing'}
                          className="text-sm font-medium px-3 py-1"
                        >
                          {item.status === 'completed' ? '✓ 已完成' : '⏳ 进行中'}
                        </Tag>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 邮件发送弹窗 */}
      <EmailSendModal
        visible={isEmailModalVisible}
        onClose={() => setIsEmailModalVisible(false)}
        onSend={handleSendEmail}
        meetingTitle={currentMeeting?.title || ''}
        defaultRecipients={
          currentMeeting?.participants?.map(p => ({
            name: p.name || p.email,
            email: p.email
          })) || []
        }
        emailPreview={generateEmailPreview()}
      />
    </div>
  )
}
