import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer

// 初始化 Socket.IO
export const initializeSocket = (socketIOServer: SocketIOServer) => {
  io = socketIOServer
}

// 获取 Socket.IO 实例
export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized')
  }
  return io
}

// 向指定会议发送消息
export const emitToMeeting = (meetingId: string, event: string, data: any) => {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot emit to meeting')
    return
  }

  io.to(`meeting-${meetingId}`).emit(event, data)
}

// 向指定用户发送消息
export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot emit to user')
    return
  }

  io.to(`user-${userId}`).emit(event, data)
}

// 向所有连接的客户端发送消息
export const broadcast = (event: string, data: any) => {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot broadcast')
    return
  }

  io.emit(event, data)
}

// 获取会议室中的连接数
export const getMeetingConnectionCount = (meetingId: string): number => {
  if (!io) {
    return 0
  }

  const room = io.sockets.adapter.rooms.get(`meeting-${meetingId}`)
  return room ? room.size : 0
}

// 获取用户当前的会议房间
export const getUserMeetingRoom = (socketId: string): string | null => {
  if (!io) {
    return null
  }

  const socket = io.sockets.sockets.get(socketId)
  if (!socket) {
    return null
  }

  // 获取用户加入的所有房间
  const rooms = Array.from(socket.rooms)
  // 查找会议房间（格式为 meeting-{meetingId}）
  const meetingRoom = rooms.find(room => room.startsWith('meeting-'))
  return meetingRoom || null
}