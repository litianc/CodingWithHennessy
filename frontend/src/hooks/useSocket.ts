import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

// Socket.IO should connect to root URL, not /api path
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001').replace('/api', '')

// 立即创建全局 socket 实例
console.log('🌍 初始化全局 Socket, URL:', SOCKET_URL)
let socket: Socket | null = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  // Demo 模式：使用特殊的认证
  auth: {
    demo: true
  }
})

socket.on('connect', () => {
  console.log('✅ 全局 Socket 已连接:', socket?.id)
})

socket.on('disconnect', (reason) => {
  console.log('👋 全局 Socket 断开连接:', reason)
})

socket.on('connect_error', (error) => {
  console.error('❌ 全局 Socket 连接错误:', error)
  console.error('❌ 错误详情:', error.message)
})

export const useSocket = (): Socket | null => {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(socket)

  useEffect(() => {
    console.log('🔌 useSocket effect 运行')
    console.log('🔌 socket:', socket)
    console.log('🔌 socket.connected:', socket?.connected)

    if (!socket) {
      console.error('❌ 全局 socket 不存在')
      return
    }

    // 如果已经连接，立即设置
    if (socket.connected) {
      console.log('✅ Socket 已连接，立即设置')
      setSocketInstance(socket)
    }

    // 监听连接事件
    const handleConnect = () => {
      console.log('✅ Socket 连接事件触发:', socket?.id)
      setSocketInstance(socket)
    }

    const handleDisconnect = (reason: string) => {
      console.log('👋 Socket 断开连接事件:', reason)
      setSocketInstance(null)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // 清理函数
    return () => {
      console.log('🧹 useSocket cleanup 运行')
      socket?.off('connect', handleConnect)
      socket?.off('disconnect', handleDisconnect)
    }
  }, [])

  console.log('🔌 useSocket 返回:', socketInstance?.connected ? 'connected' : 'not connected')
  return socketInstance
}

// 导出 disconnect 函数供需要时使用
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
