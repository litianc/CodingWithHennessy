// @ts-nocheck
import 'jest'

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-meeting-agent'
})

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global timeout for async operations
jest.setTimeout(10000)