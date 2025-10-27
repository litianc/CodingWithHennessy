import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Space,
  Popconfirm,
  Tag,
  Typography,
  Divider,
  Alert,
  Progress,
  Badge
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  AudioOutlined,
  UserOutlined,
  MailOutlined,
  UploadOutlined,
  SoundOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import {
  getVoiceprints,
  registerVoiceprint,
  deleteVoiceprint,
  updateVoiceprint,
  getSpeakerServiceHealth,
  type Voiceprint
} from '@/services/voiceprintService'

const { Title, Text } = Typography
const { TextArea } = Input

export const VoiceprintManagement: React.FC = () => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [serviceHealth, setServiceHealth] = useState<any>(null)
  const [form] = Form.useForm()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 加载声纹列表
  const loadVoiceprints = async () => {
    setLoading(true)
    try {
      const data = await getVoiceprints()
      setVoiceprints(data)
    } catch (error) {
      message.error('加载声纹列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 检查服务状态
  const checkServiceHealth = async () => {
    try {
      const health = await getSpeakerServiceHealth()
      setServiceHealth(health)
    } catch (error) {
      console.error('获取服务状态失败:', error)
    }
  }

  useEffect(() => {
    loadVoiceprints()
    checkServiceHealth()
  }, [])

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioFile = new File([audioBlob], `voiceprint-${Date.now()}.wav`, {
          type: 'audio/wav'
        })
        setAudioFile(audioFile)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // 更新录音时间
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      message.success('开始录音')
    } catch (error) {
      message.error('无法访问麦克风')
      console.error('录音错误:', error)
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      message.success('录音已停止')
    }
  }

  // 处理文件上传
  const handleFileChange = (info: any) => {
    if (info.fileList && info.fileList.length > 0) {
      const file = info.fileList[0].originFileObj || info.fileList[0]
      setAudioFile(file)
      message.success(`文件 ${file.name} 已选择`)
    } else {
      setAudioFile(null)
    }
  }

  // 注册声纹
  const handleRegister = async (values: any) => {
    if (!audioFile) {
      message.error('请先录音或上传音频文件')
      return
    }

    try {
      await registerVoiceprint({
        name: values.name,
        email: values.email,
        user_id: values.user_id,
        audio: audioFile
      })
      message.success('声纹注册成功')
      setIsModalVisible(false)
      form.resetFields()
      setAudioFile(null)
      setRecordingTime(0)
      loadVoiceprints()
    } catch (error: any) {
      message.error(error.response?.data?.message || '声纹注册失败')
    }
  }

  // 删除声纹
  const handleDelete = async (speakerId: string) => {
    try {
      await deleteVoiceprint(speakerId)
      message.success('声纹已删除')
      loadVoiceprints()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 格式化录音时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const columns = [
    {
      title: '说话人',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email?: string) => email ? (
        <Space>
          <MailOutlined />
          <Text>{email}</Text>
        </Space>
      ) : <Text type="secondary">未设置</Text>
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (user_id?: string) => user_id || <Text type="secondary">-</Text>
    },
    {
      title: '样本数量',
      dataIndex: 'sample_count',
      key: 'sample_count',
      render: (count: number) => <Tag color="blue">{count} 个样本</Tag>
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Voiceprint) => (
        <Space>
          <Popconfirm
            title="确定要删除此声纹吗？"
            onConfirm={() => handleDelete(record.speaker_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      {/* 服务状态 */}
      {serviceHealth && (
        <Alert
          message={
            <Space>
              <Badge
                status={serviceHealth.model_loaded ? 'success' : 'error'}
                text={`3D Speaker 服务状态: ${serviceHealth.status}`}
              />
              <Text type="secondary">
                已注册声纹: {serviceHealth.registered_speakers} 个
              </Text>
            </Space>
          }
          type={serviceHealth.model_loaded ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 头部操作栏 */}
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <SoundOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>声纹管理</Title>
            <Text type="secondary">({voiceprints.length} 个已注册声纹)</Text>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            注册声纹
          </Button>
        </Space>
      </Card>

      {/* 声纹列表 */}
      <Card style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={voiceprints}
          rowKey="speaker_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 注册声纹对话框 */}
      <Modal
        title="注册声纹"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
          setAudioFile(null)
          setRecordingTime(0)
          if (isRecording) {
            stopRecording()
          }
        }}
        onOk={() => form.submit()}
        width={600}
        okText="注册"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRegister}
        >
          <Form.Item
            label="说话人姓名"
            name="name"
            rules={[{ required: true, message: '请输入说话人姓名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入姓名"
            />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱（可选）"
            />
          </Form.Item>

          <Form.Item
            label="用户ID"
            name="user_id"
          >
            <Input
              placeholder="用户ID（可选）"
            />
          </Form.Item>

          <Divider>声纹样本</Divider>

          <Space direction="vertical" style={{ width: '100%' }}>
            {/* 录音按钮 */}
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>
                  <AudioOutlined /> 录制声纹样本
                </Text>
                <Space>
                  {!isRecording ? (
                    <Button
                      type="primary"
                      icon={<AudioOutlined />}
                      onClick={startRecording}
                    >
                      开始录音
                    </Button>
                  ) : (
                    <>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={stopRecording}
                      >
                        停止录音
                      </Button>
                      <Tag color="red">
                        录音中: {formatTime(recordingTime)}
                      </Tag>
                    </>
                  )}
                </Space>
                {audioFile && !isRecording && (
                  <Alert
                    message={
                      <Space>
                        <CheckCircleOutlined />
                        录音完成: {audioFile.name}
                        ({(audioFile.size / 1024).toFixed(2)} KB)
                      </Space>
                    }
                    type="success"
                    showIcon
                  />
                )}
              </Space>
            </Card>

            <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              或
            </Text>

            {/* 文件上传 */}
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>
                  <UploadOutlined /> 上传音频文件
                </Text>
                <Upload
                  accept="audio/*"
                  maxCount={1}
                  beforeUpload={() => false}
                  onChange={handleFileChange}
                >
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  支持格式: WAV, MP3, M4A 等音频格式
                </Text>
              </Space>
            </Card>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default VoiceprintManagement
