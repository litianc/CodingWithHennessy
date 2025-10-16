import React from 'react'
import { Button, Card, Typography, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  PlayCircleOutlined,
  SettingOutlined,
  ExperimentOutlined,
  AudioOutlined,
  RobotOutlined,
  MailOutlined
} from '@ant-design/icons'

const { Title, Paragraph } = Typography

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const features = [
    {
      icon: <AudioOutlined className="text-3xl text-blue-500" />,
      title: '实时语音转录',
      description: '高精度语音识别，实时转换为文字',
    },
    {
      icon: <RobotOutlined className="text-3xl text-purple-500" />,
      title: 'AI 智能分析',
      description: 'DeepSeek AI 驱动的智能会议纪要生成',
    },
    {
      icon: <MailOutlined className="text-3xl text-green-500" />,
      title: '自动邮件发送',
      description: '智能识别参会者，自动发送会议纪要',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <Title level={1} className="text-5xl font-bold mb-6 text-gradient">
              智能会议纪要 Agent
            </Title>
            <Paragraph className="text-xl text-gray-600 mb-8 leading-relaxed">
              基于 AI 技术的智能会议记录和分析系统，实时语音转录、智能声纹识别、
              AI 纪要生成，让您的会议更高效、更智能。
            </Paragraph>
            <Space size="large" className="justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  className="btn-primary"
                  onClick={() => navigate('/meeting')}
                >
                  开始会议
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="large"
                  icon={<ExperimentOutlined />}
                  className="btn-secondary"
                  onClick={() => navigate('/demo')}
                >
                  演示模式
                </Button>
              </motion.div>
            </Space>
          </motion.div>
        </div>

        {/* 装饰性元素 */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-20 animate-pulse-slow" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-purple-200 rounded-full opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-green-200 rounded-full opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-16"
          >
            <Title level={2} className="text-3xl font-bold mb-4">
              核心功能
            </Title>
            <Paragraph className="text-lg text-gray-600">
              全方位的智能会议解决方案，提升您的会议效率
            </Paragraph>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -10 }}
                className="card-gradient hover-lift"
              >
                <Card
                  className="border-0 shadow-medium hover:shadow-strong transition-all duration-300"
                  bodyStyle={{ padding: '2rem' }}
                >
                  <div className="text-center">
                    <div className="mb-6 flex justify-center">
                      {feature.icon}
                    </div>
                    <Title level={4} className="text-xl font-semibold mb-4">
                      {feature.title}
                    </Title>
                    <Paragraph className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </Paragraph>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Title level={2} className="text-3xl font-bold mb-4 text-white">
              准备好开始智能会议了吗？
            </Title>
            <Paragraph className="text-xl mb-8 text-blue-100">
              立即体验 AI 赋能的会议纪要系统
            </Paragraph>
            <Space size="large">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="large"
                  icon={<PlayCircleOutlined />}
                  className="bg-white text-blue-600 border-white hover:bg-blue-50"
                  onClick={() => navigate('/meeting')}
                >
                  立即开始
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="large"
                  icon={<SettingOutlined />}
                  className="border-white text-white hover:bg-white/10"
                  onClick={() => navigate('/settings')}
                >
                  系统设置
                </Button>
              </motion.div>
            </Space>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default HomePage