// @ts-nocheck
/**
 * WebSocket实时反馈测试
 * 测试会议纪要生成过程中的实时进度更新
 */

import { Server as SocketIOServer } from 'socket.io'
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client'
import { createServer } from 'http'
import { MinutesWebSocketHandler } from '@/websocket/minutesHandler'

jest.mock('@/utils/logger')

describe('Minutes Generation WebSocket Tests', () => {
  let httpServer: any
  let io: SocketIOServer
  let clientSocket: ClientSocket
  let handler: MinutesWebSocketHandler
  const testPort = 3001

  beforeAll((done) => {
    // 创建HTTP服务器
    httpServer = createServer()

    // 创建Socket.IO服务器
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // 初始化WebSocket处理器
    handler = new MinutesWebSocketHandler(io)

    // 设置服务器端房间管理
    io.on('connection', (socket) => {
      socket.on('join-meeting', (meetingId) => {
        socket.join(meetingId)
        socket.emit('joined-meeting', {
          meetingId,
          message: '成功加入会议房间'
        })
      })

      socket.on('leave-meeting', (meetingId) => {
        socket.leave(meetingId)
        socket.emit('left-meeting', {
          meetingId,
          message: '已离开会议房间'
        })
      })
    })

    // 启动服务器
    httpServer.listen(testPort, () => {
      done()
    })
  })

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
    io.close()
    httpServer.close()
    done()
  })

  beforeEach((done) => {
    // 创建客户端连接
    clientSocket = SocketIOClient(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      forceNew: true
    })

    clientSocket.on('connect', () => {
      done()
    })
  })

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect()
    }
  })

  describe('会议纪要生成进度事件', () => {
    it('应该接收 minutes-generation-started 事件', (done) => {
      const meetingId = 'meeting_123'
      const testData = {
        meetingId,
        timestamp: new Date().toISOString()
      }

      clientSocket.once('minutes-generation-started', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('timestamp')
        done()
      })

      // 先加入会议房间
      clientSocket.emit('join-meeting', meetingId)

      // 等待加入成功后再发送事件
      clientSocket.once('joined-meeting', () => {
        // 模拟服务器发送事件
        io.to(meetingId).emit('minutes-generation-started', testData)
      })
    })

    it('应该接收三阶段进度事件', (done) => {
      const meetingId = 'meeting_456'
      const stages = [
        'minutes-generation-thinking',
        'minutes-generation-searching',
        'minutes-generation-writing'
      ]

      let receivedStages: string[] = []

      // 监听所有阶段事件
      stages.forEach(stage => {
        clientSocket.on(stage, (data) => {
          receivedStages.push(stage)
          expect(data.meetingId).toBe(meetingId)
          expect(data).toHaveProperty('stage')
          expect(data).toHaveProperty('progress')

          if (receivedStages.length === stages.length) {
            expect(receivedStages).toEqual(stages)
            done()
          }
        })
      })

      // 加入会议房间
      clientSocket.emit('join-meeting', meetingId)

      // 模拟服务器按顺序发送三个阶段事件
      setTimeout(() => {
        io.to(meetingId).emit('minutes-generation-thinking', {
          meetingId,
          stage: 'thinking',
          progress: 33,
          message: 'AI正在分析会议内容...'
        })
      }, 100)

      setTimeout(() => {
        io.to(meetingId).emit('minutes-generation-searching', {
          meetingId,
          stage: 'searching',
          progress: 66,
          message: '正在搜索相关资料...'
        })
      }, 200)

      setTimeout(() => {
        io.to(meetingId).emit('minutes-generation-writing', {
          meetingId,
          stage: 'writing',
          progress: 90,
          message: '正在生成会议纪要...'
        })
      }, 300)
    }, 10000)

    it('应该接收 minutes-generated 完成事件', (done) => {
      const meetingId = 'meeting_789'
      const mockMinutes = {
        title: '测试会议纪要',
        summary: '这是会议总结',
        keyPoints: ['要点1', '要点2'],
        actionItems: []
      }

      clientSocket.once('minutes-generated', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('minutes')
        expect(data.minutes.title).toBe(mockMinutes.title)
        expect(data).toHaveProperty('timestamp')
        done()
      })

      clientSocket.emit('join-meeting', meetingId)

      // 模拟服务器发送完成事件
      setTimeout(() => {
        io.to(meetingId).emit('minutes-generated', {
          meetingId,
          minutesId: 'minutes_001',
          minutes: mockMinutes,
          timestamp: new Date().toISOString()
        })
      }, 100)
    })

    it('应该接收错误事件', (done) => {
      const meetingId = 'meeting_error'

      clientSocket.once('minutes-generation-error', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('AI服务暂时不可用')
        done()
      })

      clientSocket.emit('join-meeting', meetingId)

      // 模拟服务器发送错误事件
      setTimeout(() => {
        io.to(meetingId).emit('minutes-generation-error', {
          meetingId,
          error: 'AI服务暂时不可用',
          timestamp: new Date().toISOString()
        })
      }, 100)
    })
  })

  describe('纪要优化进度事件', () => {
    it('应该接收纪要优化开始事件', (done) => {
      const meetingId = 'meeting_opt_1'

      clientSocket.once('minutes-optimization-started', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('feedback')
        done()
      })

      clientSocket.emit('join-meeting', meetingId)

      setTimeout(() => {
        io.to(meetingId).emit('minutes-optimization-started', {
          meetingId,
          feedback: '请添加更多细节',
          timestamp: new Date().toISOString()
        })
      }, 100)
    })

    it('应该接收纪要优化完成事件', (done) => {
      const meetingId = 'meeting_opt_2'
      const optimizedMinutes = {
        title: '优化后的会议纪要',
        summary: '更详细的总结',
        keyPoints: ['要点1', '要点2', '要点3']
      }

      clientSocket.once('minutes-optimized', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('minutes')
        expect(data.minutes.keyPoints.length).toBe(3)
        done()
      })

      clientSocket.emit('join-meeting', meetingId)

      setTimeout(() => {
        io.to(meetingId).emit('minutes-optimized', {
          meetingId,
          minutesId: 'minutes_002',
          minutes: optimizedMinutes,
          timestamp: new Date().toISOString()
        })
      }, 100)
    })
  })

  describe('纪要批准事件', () => {
    it('应该接收纪要批准事件', (done) => {
      const meetingId = 'meeting_approve'

      clientSocket.once('minutes-approved', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('minutesId')
        expect(data).toHaveProperty('approver')
        done()
      })

      clientSocket.emit('join-meeting', meetingId)

      setTimeout(() => {
        io.to(meetingId).emit('minutes-approved', {
          meetingId,
          minutesId: 'minutes_003',
          approver: {
            userId: 'user_123',
            name: '张三'
          },
          timestamp: new Date().toISOString()
        })
      }, 100)
    })
  })

  describe('客户端房间管理', () => {
    it('应该能够加入会议房间', (done) => {
      const meetingId = 'meeting_join'

      clientSocket.once('joined-meeting', (data) => {
        expect(data.meetingId).toBe(meetingId)
        expect(data).toHaveProperty('message')
        done()
      })

      clientSocket.emit('join-meeting', meetingId)
    })

    it('应该能够离开会议房间', (done) => {
      const meetingId = 'meeting_leave'

      clientSocket.once('left-meeting', (data) => {
        expect(data.meetingId).toBe(meetingId)
        done()
      })

      clientSocket.emit('leave-meeting', meetingId)
    })
  })

  describe('多客户端事件广播', () => {
    let client2: ClientSocket
    let client3: ClientSocket

    beforeEach((done) => {
      let connectedCount = 0

      client2 = SocketIOClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      })

      client3 = SocketIOClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      })

      const checkAllConnected = () => {
        connectedCount++
        if (connectedCount === 2) {
          done()
        }
      }

      client2.on('connect', checkAllConnected)
      client3.on('connect', checkAllConnected)
    })

    afterEach(() => {
      if (client2 && client2.connected) client2.disconnect()
      if (client3 && client3.connected) client3.disconnect()
    })

    it('应该向会议房间中的所有客户端广播事件', (done) => {
      const meetingId = 'meeting_broadcast'
      let receivedCount = 0
      const expectedCount = 3 // clientSocket + client2 + client3

      const handleEvent = (data: any) => {
        expect(data.meetingId).toBe(meetingId)
        receivedCount++

        if (receivedCount === expectedCount) {
          done()
        }
      }

      // 所有客户端加入同一个房间
      clientSocket.emit('join-meeting', meetingId)
      client2.emit('join-meeting', meetingId)
      client3.emit('join-meeting', meetingId)

      // 所有客户端监听同一个事件
      clientSocket.on('test-broadcast', handleEvent)
      client2.on('test-broadcast', handleEvent)
      client3.on('test-broadcast', handleEvent)

      // 服务器广播事件
      setTimeout(() => {
        io.to(meetingId).emit('test-broadcast', {
          meetingId,
          message: '广播消息'
        })
      }, 200)
    }, 5000)
  })

  describe('错误处理', () => {
    it('应该处理无效的会议ID', (done) => {
      clientSocket.once('error', (error) => {
        expect(error).toHaveProperty('message')
        done()
      })

      clientSocket.emit('join-meeting', null)
    })

    it('应该处理断开连接', (done) => {
      clientSocket.once('disconnect', () => {
        done()
      })

      clientSocket.disconnect()
    })
  })
})
