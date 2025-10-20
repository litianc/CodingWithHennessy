import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { message } from 'antd'
import { useAuthStore } from '@/stores/authStore'

// 创建axios实例
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      // 添加认证token
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => {
      console.error('Request interceptor error:', error)
      return Promise.reject(error)
    }
  )

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      return response
    },
    async (error) => {
      const originalRequest = error.config

      // 处理401错误（未授权）
      if (error.response?.status === 401) {
        const { refreshToken, logout } = useAuthStore.getState()

        try {
          // 尝试刷新token
          if (!originalRequest._retry && refreshToken) {
            originalRequest._retry = true
            await refreshToken()
            // 重新发送原始请求
            return instance(originalRequest)
          } else {
            // 刷新失败，登出用户
            logout()
            window.location.href = '/login'
          }
        } catch (refreshError) {
          // 刷新token失败，登出用户
          logout()
          window.location.href = '/login'
        }
      }

      // 处理其他错误
      const errorMessage = error.response?.data?.message || error.message || '请求失败'
      message.error(errorMessage)

      return Promise.reject(error)
    }
  )

  return instance
}

export const api = createApiInstance()

// API请求方法封装
export const apiRequest = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return api.get(url, config).then(res => res.data)
  },

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return api.post(url, data, config).then(res => res.data)
  },

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return api.put(url, data, config).then(res => res.data)
  },

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return api.delete(url, config).then(res => res.data)
  },

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return api.patch(url, data, config).then(res => res.data)
  },

  // 文件上传
  upload: <T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    }).then(res => res.data)
  },

  // 下载文件
  download: (url: string, filename?: string) => {
    api.get(url, {
      responseType: 'blob'
    }).then((response) => {
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    })
  },

  // 上传音频文件并生成会议纪要
  uploadAudioForMinutes: <T = any>(
    meetingId: string,
    audioFile: File | Blob,
    autoGenerateMinutes: boolean = true,
    onProgress?: (progress: number) => void
  ): Promise<T> => {
    const formData = new FormData()

    // 如果是 Blob，需要转换为 File
    if (audioFile instanceof Blob && !(audioFile instanceof File)) {
      const fileName = `recording-${Date.now()}.webm`
      audioFile = new File([audioFile], fileName, { type: audioFile.type || 'audio/webm' })
    }

    formData.append('audio', audioFile)
    formData.append('autoGenerateMinutes', autoGenerateMinutes.toString())

    return api.post(`/meetings/${meetingId}/upload-audio`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
      timeout: 300000 // 5 minutes timeout for large audio files
    }).then(res => res.data)
  },

  // 发送会议纪要邮件
  sendMeetingMinutes: <T = any>(
    meetingId: string,
    customRecipients?: string[]
  ): Promise<T> => {
    return api.post(`/email/meeting/minutes`, {
      meetingId,
      customRecipients
    }).then(res => res.data)
  },

  // 发送会议邀请邮件
  sendMeetingInvitation: <T = any>(
    meetingId: string,
    customRecipients?: string[]
  ): Promise<T> => {
    return api.post(`/email/meeting/invitation`, {
      meetingId,
      customRecipients
    }).then(res => res.data)
  },

  // 发送会议提醒邮件
  sendMeetingReminder: <T = any>(
    meetingId: string,
    customRecipients?: string[]
  ): Promise<T> => {
    return api.post(`/email/meeting/reminder`, {
      meetingId,
      customRecipients
    }).then(res => res.data)
  }
}

export default api