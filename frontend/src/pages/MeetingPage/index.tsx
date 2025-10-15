import React from 'react'
import { Card, Typography } from 'antd'

const { Title } = Typography

const MeetingPage: React.FC = () => {
  return (
    <div className="container mx-auto px-6 py-8">
      <Title level={2}>会议页面</Title>
      <Card className="mt-6">
        <p>会议页面正在开发中...</p>
      </Card>
    </div>
  )
}

export default MeetingPage