import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (userData: RegisterData) => Promise<void>
  refreshToken: () => Promise<void>
  updateProfile: (userData: Partial<User>) => Promise<void>
}

interface RegisterData {
  username: string
  email: string
  password: string
  name: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ identifier: email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || '登录失败')
          }

          const data = await response.json()
          const { user, token } = data.data

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })

          // 设置axios默认header
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('token', token)
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        })

        // 清除localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('token')
        }
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || '注册失败')
          }

          const data = await response.json()
          const { user, token } = data.data

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })

          // 设置localStorage
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('token', token)
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      refreshToken: async () => {
        const { token } = get()
        if (!token) return

        try {
          const response = await fetch('/api/users/refresh-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: token }),
          })

          if (!response.ok) {
            throw new Error('Token刷新失败')
          }

          const data = await response.json()
          const newToken = data.data.accessToken

          set({ token: newToken })

          // 更新localStorage
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('token', newToken)
          }
        } catch (error) {
          // 刷新失败，登出用户
          get().logout()
          throw error
        }
      },

      updateProfile: async (userData: Partial<User>) => {
        const { token } = get()
        if (!token) throw new Error('未登录')

        try {
          const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || '更新失败')
          }

          const data = await response.json()
          const updatedUser = data.data.user

          set({ user: updatedUser })
        } catch (error) {
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)