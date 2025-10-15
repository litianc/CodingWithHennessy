import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Tabs, Divider, message } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useNotification } from '@/components/common/NotificationProvider'
import { useLoading } from '@/components/common/NotificationProvider'

const { Title, Text } = Typography

interface LoginForm {
  identifier: string
  password: string
  remember: boolean
}

interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  name: string
}

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const navigate = useNavigate()
  const { login, register, isLoading } = useAuthStore()
  const { showSuccess, showError } = useNotification()
  const { withLoading } = useLoading()

  // 登录表单
  const [loginForm, setLoginForm] = useState<LoginForm>({
    identifier: '',
    password: '',
    remember: false
  })

  // 注册表单
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 处理登录
  const handleLogin = async () => {
    if (!loginForm.identifier || !loginForm.password) {
      showError('请输入邮箱或用户名和密码')
      return
    }

    await withLoading(async () => {
      try {
        await login(loginForm.identifier, loginForm.password)
        showSuccess('登录成功')
        navigate('/')
      } catch (error: any) {
        showError(error.message || '登录失败')
      }
    })
  }

  // 处理注册
  const handleRegister = async () => {
    // 验证表单
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.name) {
      showError('请填写所有必填字段')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      showError('两次输入的密码不一致')
      return
    }

    if (registerForm.password.length < 6) {
      showError('密码长度至少6位')
      return
    }

    if (!/^[^\w-\.]+@[a-zA-Z_]+?\.[a-zA-Z]{2,}$/.test(registerForm.email)) {
      showError('请输入有效的邮箱地址')
      return
    }

    await withLoading(async () => {
      try {
        await register({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password,
          name: registerForm.name
        })
        showSuccess('注册成功')
        navigate('/')
      } catch (error: any) {
        showError(error.message || '注册失败')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl">
          <div className="p-8">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4"
              >
                <UserOutlined className="text-3xl text-white" />
              </motion.div>
              <Title level={2} className="text-center text-gray-800">
                智能会议纪要
              </Title>
              <Text type="secondary">
                AI赋能的智能会议记录系统
              </Text>
            </div>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              centered
              items={[
                {
                  key: 'login',
                  label: '登录',
                  children: (
                    <Form layout="vertical" className="space-y-4">
                      <Form.Item
                        label="邮箱或用户名"
                        required
                        validateStatus={!loginForm.identifier ? 'error' : ''}
                      >
                        <Input
                          prefix={<UserOutlined />}
                          size="large"
                          placeholder="请输入邮箱或用户名"
                          value={loginForm.identifier}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, identifier: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        label="密码"
                        required
                        validateStatus={!loginForm.password ? 'error' : ''}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          size="large"
                          placeholder="请输入密码"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, password: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={loginForm.remember}
                              onChange={(e) =>
                                setLoginForm({ ...loginForm, remember: e.target.checked })
                              }
                              className="mr-2"
                            />
                            记住我
                          </label>
                          <Link
                            to="/forgot-password"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            忘记密码？
                          </Link>
                        </div>
                      </Form.Item>

                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          size="large"
                          block
                          loading={isLoading}
                          onClick={handleLogin}
                          className="h-12 bg-gradient-to-r from-blue-500 to-purple-600"
                        >
                          登录
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: 'register',
                  label: '注册',
                  children: (
                    <Form layout="vertical" className="space-y-4">
                      <Form.Item
                        label="用户名"
                        required
                        validateStatus={!registerForm.username ? 'error' : ''}
                      >
                        <Input
                          size="large"
                          placeholder="请输入用户名"
                          value={registerForm.username}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, username: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        label="姓名"
                        required
                        validateStatus={!registerForm.name ? 'error' : ''}
                      >
                        <Input
                          size="large"
                          placeholder="请输入您的姓名"
                          value={registerForm.name}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, name: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        label="邮箱"
                        required
                        validateStatus={!registerForm.email ? 'error' : ''}
                      >
                        <Input
                          prefix={<MailOutlined />}
                          size="large"
                          placeholder="请输入邮箱地址"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, email: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        label="密码"
                        required
                        validateStatus={!registerForm.password ? 'error' : ''}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          size="large"
                          placeholder="请输入密码"
                          value={registerForm.password}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, password: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        label="确认密码"
                        required
                        validateStatus={
                          registerForm.confirmPassword !== registerForm.password ? 'error' : ''
                        }
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          size="large"
                          placeholder="请再次输入密码"
                          value={registerForm.confirmPassword}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, confirmPassword: e.target.value })
                          }
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          size="large"
                          block
                          loading={isLoading}
                          onClick={handleRegister}
                          className="h-12 bg-gradient-to-r from-blue-500 to-purple-600"
                        >
                          注册
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}