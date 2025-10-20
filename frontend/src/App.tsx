import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import HomePage from '@/pages/HomePage'
import MeetingPage from '@/pages/MeetingPage'
import { MeetingDetailPage } from '@/pages/MeetingDetailPage'
import SettingsPage from '@/pages/SettingsPage'
import DemoPage from '@/pages/DemoPage'
import ErrorBoundary from '@/components/common/ErrorBoundary'

// 页面转场动画配置
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 },
}

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <motion.div
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/meeting" element={<MeetingPage />} />
            <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/demo" element={<DemoPage />} />
          </Routes>
        </motion.div>
      </div>
    </ErrorBoundary>
  )
}

export default App