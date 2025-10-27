import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/authStore'

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface WebSocketState {
  socket: Socket | null
  isConnected: boolean
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error: string | null
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000
  } = options

  const { token, isAuthenticated } = useAuthStore()
  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected',
    error: null
  })

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)

  const connect = () => {
    // Demo模式：允许无token连接
    // if (!token || !isAuthenticated) {
    //   return
    // }

    setState(prev => ({ ...prev, connectionStatus: 'connecting', error: null }))

    // 使用相对路径（空字符串）让 socket.io 自动使用当前域名和端口
    // 这样会通过 Vite proxy 转发到后端 5001
    const wsUrl = import.meta.env.VITE_WS_URL || ''
    const socket = io(wsUrl, {
      auth: { token: token || 'demo-token' },
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
    })

    socket.on('connect', () => {
      setState({
        socket,
        isConnected: true,
        connectionStatus: 'connected',
        error: null
      })
      reconnectAttemptsRef.current = 0
    })

    socket.on('disconnect', () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected'
      }))
    })

    socket.on('connect_error', (error) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionStatus: 'disconnected',
        error: error.message
      }))

      // 自动重连
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        reconnectAttemptsRef.current++
        setState(prev => ({ ...prev, connectionStatus: 'reconnecting' }))

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectDelay * reconnectAttemptsRef.current)
      }
    })

    socket.on('error', (error) => {
      setState(prev => ({
        ...prev,
        error: error.message
      }))
    })

    setState(prev => ({ ...prev, socket }))
  }

  const disconnect = () => {
    if (state.socket) {
      state.socket.disconnect()
      setState({
        socket: null,
        isConnected: false,
        connectionStatus: 'disconnected',
        error: null
      })
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
  }

  const emit = (event: string, data?: any) => {
    if (state.socket && state.isConnected) {
      state.socket.emit(event, data)
    }
  }

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (state.socket) {
      state.socket.on(event, callback)
    }
  }

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (state.socket) {
      state.socket.off(event, callback)
    }
  }

  const joinRoom = (room: string) => {
    if (state.socket && state.isConnected) {
      state.socket.emit('join-room', { room })
    }
  }

  const leaveRoom = (room: string) => {
    if (state.socket && state.isConnected) {
      state.socket.emit('leave-room', { room })
    }
  }

  useEffect(() => {
    // Demo模式：自动连接无需认证
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect])

  return {
    socket: state.socket,
    isConnected: state.isConnected,
    connectionStatus: state.connectionStatus,
    error: state.error,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom
  }
}