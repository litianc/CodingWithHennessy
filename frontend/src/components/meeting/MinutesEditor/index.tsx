import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Space, Typography, Divider, Card, Row, Col, Select, DatePicker, Tag, message as antMessage } from 'antd'
import { SaveOutlined, UndoOutlined, CloseOutlined, EditOutlined, CheckOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { MeetingMinutes } from '@/types'
import { useMeetingStore } from '@/stores/meetingStore'

const { TextArea } = Input
const { Title, Text } = Typography
const { Option } = Select

interface MinutesEditorProps {
  meetingId: string
  minutes?: MeetingMinutes
  onSave?: (minutes: MeetingMinutes) => void
  onCancel?: () => void
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export const MinutesEditor: React.FC<MinutesEditorProps> = ({
  meetingId,
  minutes,
  onSave,
  onCancel
}) => {
  const [form] = Form.useForm()
  // 使用细粒度选择器，只订阅需要的函数
  const updateMeetingMinutes = useMeetingStore((state) => state.updateMeetingMinutes)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasChanges, setHasChanges] = useState(false)

  // 初始化表单
  useEffect(() => {
    if (minutes) {
      form.setFieldsValue({
        title: minutes.title,
        summary: minutes.summary,
        keyPoints: minutes.keyPoints || [],
        actionItems: minutes.actionItems || [],
        decisions: minutes.decisions || []
      })
    }
  }, [minutes, form])

  // 监听表单变化
  const handleFormChange = () => {
    setHasChanges(true)
    setSaveStatus('unsaved')
  }

  // 保存纪要
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaveStatus('saving')

      const updatedMinutes: Partial<MeetingMinutes> = {
        title: values.title,
        summary: values.summary,
        keyPoints: values.keyPoints?.filter((p: string) => p?.trim()) || [],
        actionItems: values.actionItems?.map((item: any) => ({
          description: item.description,
          assignee: item.assignee || '未指定',
          priority: item.priority || 'medium',
          dueDate: item.dueDate
        })) || [],
        decisions: values.decisions?.map((dec: any) => ({
          description: dec.description,
          decisionMaker: dec.decisionMaker || '未指定',
          timestamp: dec.timestamp || new Date()
        })) || []
      }

      await updateMeetingMinutes(meetingId, updatedMinutes)

      setSaveStatus('saved')
      setHasChanges(false)
      antMessage.success('会议纪要已保存')

      if (onSave) {
        onSave(updatedMinutes as MeetingMinutes)
      }
    } catch (error: any) {
      console.error('保存失败:', error)
      setSaveStatus('error')
      antMessage.error(error.message || '保存失败')
    }
  }

  // 重置表单
  const handleReset = () => {
    form.resetFields()
    setHasChanges(false)
    setSaveStatus('saved')
  }

  // 获取保存状态显示
  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saved':
        return <Tag color="success" icon={<CheckOutlined />}>已保存</Tag>
      case 'saving':
        return <Tag color="processing">保存中...</Tag>
      case 'unsaved':
        return <Tag color="warning">未保存</Tag>
      case 'error':
        return <Tag color="error">保存失败</Tag>
      default:
        return null
    }
  }

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <EditOutlined />
            <span>编辑会议纪要</span>
          </div>
          <div>{getSaveStatusDisplay()}</div>
        </div>
      }
      extra={
        <Space>
          <Button onClick={handleReset} icon={<UndoOutlined />} disabled={!hasChanges}>
            重置
          </Button>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            icon={<SaveOutlined />}
            loading={saveStatus === 'saving'}
            disabled={!hasChanges}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
      >
        {/* 标题 */}
        <Form.Item
          label="会议标题"
          name="title"
          rules={[{ required: true, message: '请输入会议标题' }]}
        >
          <Input placeholder="请输入会议标题" size="large" />
        </Form.Item>

        {/* 摘要 */}
        <Form.Item
          label="会议摘要"
          name="summary"
          rules={[{ required: true, message: '请输入会议摘要' }]}
        >
          <TextArea
            placeholder="请输入会议摘要，简要概括会议主要内容"
            rows={4}
            showCount
            maxLength={500}
          />
        </Form.Item>

        <Divider>关键要点</Divider>

        {/* 关键要点 */}
        <Form.List name="keyPoints">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Form.Item
                  key={field.key}
                  label={`要点 ${index + 1}`}
                  required={false}
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item
                      {...field}
                      noStyle
                      rules={[{ required: true, message: '请输入关键要点' }]}
                    >
                      <Input placeholder="请输入关键要点" />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </Space.Compact>
                </Form.Item>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  block
                >
                  添加关键要点
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Divider>行动项</Divider>

        {/* 行动项 */}
        <Form.List name="actionItems">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`行动项 ${index + 1}`}
                  extra={
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  }
                  className="mb-4"
                >
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'description']}
                        label="描述"
                        rules={[{ required: true, message: '请输入行动项描述' }]}
                      >
                        <Input placeholder="请输入行动项描述" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'assignee']}
                        label="负责人"
                      >
                        <Input placeholder="请输入负责人姓名" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'priority']}
                        label="优先级"
                        initialValue="medium"
                      >
                        <Select>
                          <Option value="low">低</Option>
                          <Option value="medium">中</Option>
                          <Option value="high">高</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  block
                >
                  添加行动项
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Divider>决策记录</Divider>

        {/* 决策记录 */}
        <Form.List name="decisions">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`决策 ${index + 1}`}
                  extra={
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  }
                  className="mb-4"
                >
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'description']}
                        label="决策描述"
                        rules={[{ required: true, message: '请输入决策描述' }]}
                      >
                        <Input placeholder="请输入决策描述" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'decisionMaker']}
                        label="决策者"
                      >
                        <Input placeholder="请输入决策者姓名" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  block
                >
                  添加决策记录
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Card>
  )
}
