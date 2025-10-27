import React, { useState } from 'react'
import { Card, Typography, Tabs } from 'antd'
import { SoundOutlined, SettingOutlined, BellOutlined, SecurityScanOutlined } from '@ant-design/icons'
import VoiceprintManagement from '@/components/voiceprint/VoiceprintManagement'

const { Title } = Typography

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('voiceprint')

  const items = [
    {
      key: 'voiceprint',
      label: (
        <span>
          <SoundOutlined />
          声纹管理
        </span>
      ),
      children: <VoiceprintManagement />
    },
    {
      key: 'general',
      label: (
        <span>
          <SettingOutlined />
          通用设置
        </span>
      ),
      children: (
        <Card>
          <p>通用设置功能开发中...</p>
        </Card>
      )
    },
    {
      key: 'notifications',
      label: (
        <span>
          <BellOutlined />
          通知设置
        </span>
      ),
      children: (
        <Card>
          <p>通知设置功能开发中...</p>
        </Card>
      )
    },
    {
      key: 'privacy',
      label: (
        <span>
          <SecurityScanOutlined />
          隐私设置
        </span>
      ),
      children: (
        <Card>
          <p>隐私设置功能开发中...</p>
        </Card>
      )
    }
  ]

  return (
    <div className="container mx-auto px-6 py-8">
      <Title level={2}>系统设置</Title>
      <div className="mt-6">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          size="large"
        />
      </div>
    </div>
  )
}

export default SettingsPage
