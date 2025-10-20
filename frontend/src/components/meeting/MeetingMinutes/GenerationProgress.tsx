import React from 'react'
import { Progress, Card } from 'antd'
import { motion } from 'framer-motion'
import {
  BulbOutlined,
  SearchOutlined,
  EditOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'

interface GenerationStage {
  stage: 'thinking' | 'searching' | 'writing' | 'completed'
  progress: number
  message: string
}

interface GenerationProgressProps {
  currentStage: GenerationStage
  isGenerating: boolean
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  currentStage,
  isGenerating
}) => {
  const stages = [
    {
      key: 'thinking',
      icon: <BulbOutlined style={{ fontSize: '32px' }} />,
      emoji: '🤔',
      title: '思考分析',
      description: 'AI正在分析会议内容...',
      color: '#1890ff',
      progress: 33
    },
    {
      key: 'searching',
      icon: <SearchOutlined style={{ fontSize: '32px' }} />,
      emoji: '🔍',
      title: '搜索资料',
      description: '正在搜索相关资料...',
      color: '#52c41a',
      progress: 66
    },
    {
      key: 'writing',
      icon: <EditOutlined style={{ fontSize: '32px' }} />,
      emoji: '✍️',
      title: '生成纪要',
      description: '正在生成会议纪要...',
      color: '#faad14',
      progress: 90
    },
    {
      key: 'completed',
      icon: <CheckCircleOutlined style={{ fontSize: '32px' }} />,
      emoji: '✅',
      title: '生成完成',
      description: '会议纪要已成功生成！',
      color: '#52c41a',
      progress: 100
    }
  ]

  const getCurrentStageInfo = () => {
    return stages.find(s => s.key === currentStage.stage) || stages[0]
  }

  const currentStageInfo = getCurrentStageInfo()
  const currentStageIndex = stages.findIndex(s => s.key === currentStage.stage)

  if (!isGenerating) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card className="shadow-lg border-2 border-blue-200">
        <div className="text-center space-y-6">
          {/* 当前阶段图标 */}
          <motion.div
            key={currentStage.stage}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15
            }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white shadow-lg"
          >
            <span className="text-4xl">{currentStageInfo.emoji}</span>
          </motion.div>

          {/* 阶段标题和描述 */}
          <div className="space-y-2">
            <motion.h3
              key={currentStageInfo.title}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-gray-800"
            >
              {currentStageInfo.title}
            </motion.h3>
            <motion.p
              key={currentStage.message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-600"
            >
              {currentStage.message || currentStageInfo.description}
            </motion.p>
          </div>

          {/* 进度条 */}
          <div className="space-y-3">
            <Progress
              percent={currentStage.progress}
              strokeColor={{
                from: '#108ee9',
                to: '#87d068',
              }}
              strokeWidth={12}
              showInfo={false}
            />
            <div className="text-sm text-gray-500 font-medium">
              {currentStage.progress}%
            </div>
          </div>

          {/* 阶段指示器 */}
          <div className="flex justify-center items-center space-x-4 pt-4">
            {stages.map((stage, index) => {
              const isActive = index === currentStageIndex
              const isCompleted = index < currentStageIndex

              return (
                <div key={stage.key} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{
                      scale: isActive ? 1.2 : 1,
                      backgroundColor: isCompleted
                        ? '#52c41a'
                        : isActive
                        ? stage.color
                        : '#d9d9d9'
                    }}
                    transition={{ duration: 0.3 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md"
                  >
                    {isCompleted ? (
                      <CheckCircleOutlined style={{ fontSize: '20px' }} />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </motion.div>
                  {index < stages.length - 1 && (
                    <div
                      className={`w-12 h-1 mx-2 rounded ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* 阶段名称 */}
          <div className="flex justify-center space-x-8 pt-2">
            {stages.map((stage, index) => {
              const isActive = index === currentStageIndex
              return (
                <div
                  key={stage.key}
                  className={`text-xs ${
                    isActive ? 'text-blue-600 font-bold' : 'text-gray-500'
                  }`}
                >
                  {stage.title}
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
