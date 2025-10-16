// @ts-nocheck
import 'jest'
import mongoose from 'mongoose'

// Set test environment variables before anything else
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test-meeting-agent'

// Global test setup
beforeAll(async () => {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI as string, {
        serverSelectionTimeoutMS: 5000,
      })
    } catch (error) {
      console.warn('MongoDB connection failed, some tests may be skipped:', error.message)
    }
  }
}, 30000)

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close()
  }
}, 30000)

// Global timeout for async operations
jest.setTimeout(30000)