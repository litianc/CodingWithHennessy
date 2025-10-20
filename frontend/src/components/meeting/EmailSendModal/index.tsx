import React, { useState, useEffect } from 'react'
import { Modal, Button, Form, Input, Tag, Space, Divider, Typography, Alert, Checkbox, Card } from 'antd'
import {
  MailOutlined,
  SendOutlined,
  EyeOutlined,
  UserOutlined,
  CloseOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNotification } from '@/components/common/NotificationProvider'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface EmailSendModalProps {
  visible: boolean
  onClose: () => void
  onSend: (recipients: string[], customRecipients?: string[]) => Promise<void>
  meetingTitle: string
  defaultRecipients: Array<{ name: string; email: string }>
  emailPreview: {
    subject: string
    content: string
  }
}

export const EmailSendModal: React.FC<EmailSendModalProps> = ({
  visible,
  onClose,
  onSend,
  meetingTitle,
  defaultRecipients,
  emailPreview
}) => {
  const [form] = Form.useForm()
  const { showSuccess, showError } = useNotification()
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())
  const [customEmails, setCustomEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)

  // 初始化：默认选中所有参与者
  useEffect(() => {
    if (visible) {
      const allEmails = new Set(defaultRecipients.map(r => r.email))
      setSelectedRecipients(allEmails)
      setCustomEmails([])
      setNewEmail('')
      setShowPreview(false)
      form.resetFields()
    }
  }, [visible, defaultRecipients, form])

  // 切换收件人选择
  const toggleRecipient = (email: string) => {
    const newSelected = new Set(selectedRecipients)
    if (newSelected.has(email)) {
      newSelected.delete(email)
    } else {
      newSelected.add(email)
    }
    setSelectedRecipients(newSelected)
  }

  // 添加自定义邮箱
  const addCustomEmail = () => {
    const email = newEmail.trim()
    if (!email) {
      showError('请输入邮箱地址')
      return
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showError('请输入有效的邮箱地址')
      return
    }

    // 检查是否已存在
    if (customEmails.includes(email) || defaultRecipients.some(r => r.email === email)) {
      showError('该邮箱已在收件人列表中')
      return
    }

    setCustomEmails([...customEmails, email])
    setNewEmail('')
  }

  // 移除自定义邮箱
  const removeCustomEmail = (email: string) => {
    setCustomEmails(customEmails.filter(e => e !== email))
  }

  // 发送邮件
  const handleSend = async () => {
    // 获取所有收件人
    const recipients = Array.from(selectedRecipients)
    const allRecipients = [...recipients, ...customEmails]

    if (allRecipients.length === 0) {
      showError('请至少选择一个收件人')
      return
    }

    try {
      setSending(true)
      await onSend(recipients, customEmails.length > 0 ? customEmails : undefined)
      showSuccess(`会议纪要已成功发送给 ${allRecipients.length} 位收件人`)
      onClose()
    } catch (error: any) {
      showError(error.message || '发送邮件失败')
    } finally {
      setSending(false)
    }
  }

  // 获取所有收件人总数
  const getTotalRecipients = () => {
    return selectedRecipients.size + customEmails.length
  }

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <MailOutlined className="text-blue-600 text-xl" />
          </div>
          <div>
            <Title level={4} className="mb-0">发送会议纪要</Title>
            <Text type="secondary" className="text-sm">{meetingTitle}</Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div className="space-y-6 mt-6">
        {/* 邮件预览切换 */}
        <div className="flex justify-between items-center">
          <Text strong>选择收件人 ({getTotalRecipients()} 人)</Text>
          <Button
            type={showPreview ? 'primary' : 'default'}
            icon={<EyeOutlined />}
            onClick={() => setShowPreview(!showPreview)}
            size="small"
          >
            {showPreview ? '隐藏预览' : '预览邮件'}
          </Button>
        </div>

        {/* 邮件预览 */}
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              size="small"
              title="邮件预览"
              className="bg-gray-50"
            >
              <div className="space-y-3">
                <div>
                  <Text type="secondary" className="text-xs">主题</Text>
                  <div className="font-semibold text-gray-800 mt-1">
                    {emailPreview.subject}
                  </div>
                </div>
                <Divider className="my-2" />
                <div>
                  <Text type="secondary" className="text-xs">内容</Text>
                  <div
                    className="mt-2 p-4 bg-white rounded border border-gray-200 max-h-60 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: emailPreview.content }}
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* 默认参与者列表 */}
        {defaultRecipients.length > 0 && (
          <div>
            <Text strong className="text-sm">会议参与者</Text>
            <div className="mt-3 space-y-2">
              {defaultRecipients.map((recipient, index) => (
                <motion.div
                  key={recipient.email}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedRecipients.has(recipient.email)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                  onClick={() => toggleRecipient(recipient.email)}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedRecipients.has(recipient.email)}
                      onChange={() => toggleRecipient(recipient.email)}
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {recipient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{recipient.name}</div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <MailOutlined className="mr-1" />
                        {recipient.email}
                      </div>
                    </div>
                  </div>
                  {selectedRecipients.has(recipient.email) && (
                    <Tag color="success">已选择</Tag>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 添加自定义收件人 */}
        <div>
          <Text strong className="text-sm">添加其他收件人</Text>
          <div className="mt-3 flex space-x-2">
            <Input
              placeholder="输入邮箱地址后按回车或点击添加"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onPressEnter={addCustomEmail}
              prefix={<MailOutlined />}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={addCustomEmail}
            >
              添加
            </Button>
          </div>

          {/* 自定义邮箱列表 */}
          {customEmails.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customEmails.map((email) => (
                <Tag
                  key={email}
                  color="blue"
                  closable
                  onClose={() => removeCustomEmail(email)}
                  icon={<UserOutlined />}
                  className="px-3 py-1"
                >
                  {email}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* 发送提示 */}
        {getTotalRecipients() === 0 ? (
          <Alert
            message="请至少选择一个收件人"
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            message={`即将发送会议纪要给 ${getTotalRecipients()} 位收件人`}
            type="info"
            showIcon
          />
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            onClick={onClose}
            disabled={sending}
          >
            取消
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={getTotalRecipients() === 0}
            size="large"
          >
            确认发送
          </Button>
        </div>
      </div>
    </Modal>
  )
}
