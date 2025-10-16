import React from 'react'
import { Card, Typography, Row, Col } from 'antd'
import { MeetingControl } from '@/components/meeting/MeetingControl'

const { Title } = Typography

import { useMeetingStore } from '@/stores/meetingStore'
import { useEffect } from 'react'

const MeetingPage: React.FC = () => {
  const { currentMeeting, setCurrentMeeting, updateMeeting } = useMeetingStore()

  // 初始化模拟会议数据
  useEffect(() => {
    if (!currentMeeting) {
      const mockMeeting = {
        _id: 'demo-meeting-1',
        title: '产品开发会议',
        status: 'scheduled',
        participants: [
          { id: '1', name: '张三', email: 'zhangsan@example.com' },
          { id: '2', name: '李四', email: 'lisi@example.com' }
        ],
        startTime: new Date(),
        description: '讨论新功能开发计划',
        settings: {
          allowRecording: true,
          enableTranscription: true,
          enableVoiceprint: true,
          autoGenerateMinutes: true,
          language: 'zh-CN'
        }
      }
      setCurrentMeeting(mockMeeting as any)
    }
  }, [])

  const handleStartMeeting = async () => {
    console.log('开始会议')
    if (currentMeeting) {
      // Demo模式：直接更新状态
      updateMeeting(currentMeeting._id, { status: 'in_progress', actualStartTime: new Date() })
    }
  }

  const handleEndMeeting = async () => {
    console.log('结束会议')
    if (currentMeeting) {
      updateMeeting(currentMeeting._id, { status: 'completed', actualEndTime: new Date() })
    }
  }

  const handleJoinMeeting = async () => {
    console.log('加入会议')
    // Demo模式：简单提示
  }

  const handleLeaveMeeting = async () => {
    console.log('离开会议')
    // Demo模式：简单提示
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <Title level={2}>会议控制面板</Title>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <MeetingControl
            meeting={currentMeeting as any}
            onStartMeeting={handleStartMeeting}
            onEndMeeting={handleEndMeeting}
            onJoinMeeting={handleJoinMeeting}
            onLeaveMeeting={handleLeaveMeeting}
          />
        </Col>

        <Col span={24}>
          <Card>
            <Title level={4}>其他会议功能</Title>
            <ul>
              <li>✅ 实时语音转录</li>
              <li>✅ 声纹识别</li>
              <li>✅ AI 纪要生成</li>
              <li>✅ 参会者管理</li>
              <li>✅ 邮件发送</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default MeetingPage