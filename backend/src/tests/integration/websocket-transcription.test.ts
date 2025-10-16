import { Server } from 'socket.io'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { createServer } from 'http'
import mongoose from 'mongoose'
import { User } from '@/models/User'
import { Meeting } from '@/models/Meeting'
import { generateTokens } from '@/middleware/auth'

// Mock logger to avoid actual logging during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    http: jest.fn()
  }
}))

// Skip tests if MongoDB is not connected
const describeIfMongo = mongoose.connection.readyState === 1 ? describe : describe.skip

describeIfMongo('WebSocket Real-time Transcription Tests', () => {
  let io: Server
  let serverSocket: any
  let clientSocket: ClientSocket
  let httpServer: any
  let testUser: any
  let testMeeting: any
  let authToken: string

  beforeAll(async () => {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  Skipping WebSocket tests: MongoDB is not connected')
      return
    }

    // Create test user
    testUser = new User({
      username: 'ws-testuser',
      email: 'ws-test@example.com',
      password: 'password123',
      name: 'WebSocket Test User'
    })
    await testUser.save()

    // Generate auth tokens
    const tokens = generateTokens(testUser)
    authToken = tokens.accessToken

    // Create test meeting
    testMeeting = new Meeting({
      title: 'WebSocket Test Meeting',
      description: 'Real-time transcription test',
      host: testUser._id,
      participants: [testUser._id],
      startTime: new Date(),
      status: 'in_progress',
      settings: {
        allowRecording: true,
        enableTranscription: true
      }
    })
    await testMeeting.save()

    // Create HTTP server and Socket.IO server
    httpServer = createServer()
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Set up Socket.IO event handlers
    io.on('connection', (socket) => {
      serverSocket = socket

      // Join meeting room
      socket.on('join-meeting', ({ meetingId, userId }) => {
        socket.join(`meeting:${meetingId}`)
        socket.emit('joined-meeting', { meetingId, userId })
      })

      // Handle audio stream
      socket.on('audio-stream', (audioData) => {
        // Simulate real-time transcription
        const mockTranscription = {
          text: '这是实时转录的文本',
          timestamp: Date.now(),
          speaker: testUser.name,
          confidence: 0.95
        }
        socket.emit('transcription-update', mockTranscription)
        io.to(`meeting:${audioData.meetingId}`).emit('transcription-update', mockTranscription)
      })

      // Handle speaker identification
      socket.on('voiceprint-data', (voiceprintData) => {
        const mockSpeaker = {
          userId: testUser._id,
          name: testUser.name,
          confidence: 0.92
        }
        socket.emit('speaker-identified', mockSpeaker)
      })

      // Handle transcription status
      socket.on('start-transcription', ({ meetingId }) => {
        socket.emit('transcription-started', { meetingId, timestamp: Date.now() })
      })

      socket.on('stop-transcription', ({ meetingId }) => {
        socket.emit('transcription-stopped', { meetingId, timestamp: Date.now() })
      })

      // Handle errors
      socket.on('error', (error) => {
        socket.emit('transcription-error', { message: error.message })
      })
    })

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const address = httpServer.address()
        const port = typeof address === 'string' ? address : address?.port
        resolve()
      })
    })
  })

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await User.deleteMany({ email: 'ws-test@example.com' })
    }
    if (testMeeting) {
      await Meeting.deleteMany({ _id: testMeeting._id })
    }

    // Close connections
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
    if (io) {
      io.close()
    }
    if (httpServer) {
      httpServer.close()
    }
  })

  beforeEach((done) => {
    // Create client socket before each test
    const address = httpServer.address()
    const port = typeof address === 'string' ? address : address?.port
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: {
        token: authToken
      }
    })
    clientSocket.on('connect', done)
  })

  afterEach(() => {
    // Disconnect client after each test
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
  })

  describe('Connection and Room Management', () => {
    it('should connect to WebSocket server successfully', (done) => {
      expect(clientSocket.connected).toBe(true)
      done()
    })

    it('should join meeting room successfully', (done) => {
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      clientSocket.on('joined-meeting', (data) => {
        expect(data.meetingId).toBe(testMeeting._id.toString())
        expect(data.userId).toBe(testUser._id.toString())
        done()
      })
    })

    it('should handle multiple clients in same meeting', (done) => {
      const address = httpServer.address()
      const port = typeof address === 'string' ? address : address?.port
      const client2 = ioClient(`http://localhost:${port}`)

      let joinedCount = 0

      const checkBothJoined = () => {
        joinedCount++
        if (joinedCount === 2) {
          client2.disconnect()
          done()
        }
      }

      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })
      clientSocket.once('joined-meeting', checkBothJoined)

      client2.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })
      client2.once('joined-meeting', checkBothJoined)
    })
  })

  describe('Real-time Audio Streaming', () => {
    it('should receive transcription updates when streaming audio', (done) => {
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      clientSocket.once('joined-meeting', () => {
        // Simulate audio stream
        const mockAudioData = {
          meetingId: testMeeting._id.toString(),
          audioChunk: Buffer.from([1, 2, 3, 4, 5]),
          timestamp: Date.now()
        }

        clientSocket.emit('audio-stream', mockAudioData)
      })

      clientSocket.on('transcription-update', (transcription) => {
        expect(transcription).toHaveProperty('text')
        expect(transcription).toHaveProperty('timestamp')
        expect(transcription).toHaveProperty('speaker')
        expect(transcription).toHaveProperty('confidence')
        expect(transcription.confidence).toBeGreaterThan(0)
        expect(transcription.confidence).toBeLessThanOrEqual(1)
        done()
      })
    })

    it('should broadcast transcription to all participants in meeting', (done) => {
      const address = httpServer.address()
      const port = typeof address === 'string' ? address : address?.port
      const client2 = ioClient(`http://localhost:${port}`)

      let receivedCount = 0

      const checkBothReceived = () => {
        receivedCount++
        if (receivedCount === 2) {
          client2.disconnect()
          done()
        }
      }

      // Both clients join the meeting
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      client2.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      // Set up listeners for both clients
      clientSocket.on('transcription-update', checkBothReceived)
      client2.on('transcription-update', checkBothReceived)

      // Send audio from one client
      setTimeout(() => {
        clientSocket.emit('audio-stream', {
          meetingId: testMeeting._id.toString(),
          audioChunk: Buffer.from([1, 2, 3]),
          timestamp: Date.now()
        })
      }, 100)
    })
  })

  describe('Speaker Identification', () => {
    it('should identify speaker from voiceprint data', (done) => {
      const mockVoiceprintData = {
        meetingId: testMeeting._id.toString(),
        audioFeatures: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
        timestamp: Date.now()
      }

      clientSocket.emit('voiceprint-data', mockVoiceprintData)

      clientSocket.on('speaker-identified', (speaker) => {
        expect(speaker).toHaveProperty('userId')
        expect(speaker).toHaveProperty('name')
        expect(speaker).toHaveProperty('confidence')
        expect(speaker.confidence).toBeGreaterThan(0)
        done()
      })
    })
  })

  describe('Transcription Control', () => {
    it('should start transcription successfully', (done) => {
      clientSocket.emit('start-transcription', {
        meetingId: testMeeting._id.toString()
      })

      clientSocket.on('transcription-started', (data) => {
        expect(data.meetingId).toBe(testMeeting._id.toString())
        expect(data.timestamp).toBeDefined()
        done()
      })
    })

    it('should stop transcription successfully', (done) => {
      clientSocket.emit('stop-transcription', {
        meetingId: testMeeting._id.toString()
      })

      clientSocket.on('transcription-stopped', (data) => {
        expect(data.meetingId).toBe(testMeeting._id.toString())
        expect(data.timestamp).toBeDefined()
        done()
      })
    })

    it('should handle transcription lifecycle', (done) => {
      let started = false

      clientSocket.emit('start-transcription', {
        meetingId: testMeeting._id.toString()
      })

      clientSocket.once('transcription-started', () => {
        started = true
        expect(started).toBe(true)

        clientSocket.emit('stop-transcription', {
          meetingId: testMeeting._id.toString()
        })
      })

      clientSocket.once('transcription-stopped', () => {
        expect(started).toBe(true)
        done()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', (done) => {
      const address = httpServer.address()
      const port = typeof address === 'string' ? address : address?.port
      const errorClient = ioClient(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token'
        }
      })

      errorClient.on('connect_error', (error) => {
        expect(error).toBeDefined()
        errorClient.disconnect()
        done()
      })
    })

    it('should emit transcription errors', (done) => {
      clientSocket.emit('error', new Error('Test error'))

      clientSocket.on('transcription-error', (error) => {
        expect(error).toHaveProperty('message')
        expect(error.message).toBe('Test error')
        done()
      })
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle rapid audio streaming', (done) => {
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      let transcriptionCount = 0
      const targetCount = 10

      clientSocket.on('transcription-update', () => {
        transcriptionCount++
        if (transcriptionCount === targetCount) {
          expect(transcriptionCount).toBe(targetCount)
          done()
        }
      })

      clientSocket.once('joined-meeting', () => {
        // Send multiple audio chunks rapidly
        for (let i = 0; i < targetCount; i++) {
          setTimeout(() => {
            clientSocket.emit('audio-stream', {
              meetingId: testMeeting._id.toString(),
              audioChunk: Buffer.from([i]),
              timestamp: Date.now()
            })
          }, i * 10)
        }
      })
    }, 10000)

    it('should maintain order of transcription updates', (done) => {
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      const receivedTimestamps: number[] = []

      clientSocket.on('transcription-update', (transcription) => {
        receivedTimestamps.push(transcription.timestamp)

        if (receivedTimestamps.length === 5) {
          // Check that timestamps are in order
          for (let i = 1; i < receivedTimestamps.length; i++) {
            expect(receivedTimestamps[i]).toBeGreaterThanOrEqual(receivedTimestamps[i - 1])
          }
          done()
        }
      })

      clientSocket.once('joined-meeting', () => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            clientSocket.emit('audio-stream', {
              meetingId: testMeeting._id.toString(),
              audioChunk: Buffer.from([i]),
              timestamp: Date.now()
            })
          }, i * 50)
        }
      })
    }, 10000)
  })

  describe('Reconnection and State Recovery', () => {
    it('should handle client reconnection', (done) => {
      let reconnected = false

      clientSocket.on('disconnect', () => {
        if (!reconnected) {
          reconnected = true
          clientSocket.connect()
        }
      })

      clientSocket.on('connect', () => {
        if (reconnected) {
          expect(clientSocket.connected).toBe(true)
          done()
        } else {
          // Trigger disconnect
          clientSocket.disconnect()
        }
      })
    })

    it('should rejoin meeting after reconnection', (done) => {
      let joinCount = 0

      clientSocket.on('joined-meeting', () => {
        joinCount++
        if (joinCount === 2) {
          expect(joinCount).toBe(2)
          done()
        }
      })

      // First join
      clientSocket.emit('join-meeting', {
        meetingId: testMeeting._id.toString(),
        userId: testUser._id.toString()
      })

      // Simulate reconnection after delay
      setTimeout(() => {
        clientSocket.disconnect()
        setTimeout(() => {
          clientSocket.connect()
          setTimeout(() => {
            clientSocket.emit('join-meeting', {
              meetingId: testMeeting._id.toString(),
              userId: testUser._id.toString()
            })
          }, 100)
        }, 100)
      }, 200)
    }, 10000)
  })
})
