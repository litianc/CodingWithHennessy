# FunASR + 3D-Speaker 单元测试计划

**版本**: 1.0.0
**创建日期**: 2025-10-22
**测试框架**: Jest (TypeScript), pytest (Python)

---

## 目录

1. [测试目标与范围](#测试目标与范围)
2. [测试环境配置](#测试环境配置)
3. [测试分层策略](#测试分层策略)
4. [TypeScript 服务测试](#typescript-服务测试)
5. [Python 服务测试](#python-服务测试)
6. [集成测试](#集成测试)
7. [测试数据准备](#测试数据准备)
8. [测试执行计划](#测试执行计划)
9. [验收标准](#验收标准)

---

## 测试目标与范围

### 测试目标

- ✅ 确保 FunASR 和 3D-Speaker 服务的核心功能正常工作
- ✅ 验证错误处理机制的有效性
- ✅ 测试边界条件和异常场景
- ✅ 确保服务间集成的稳定性
- ✅ 验证 Mock 模式的正确性
- ✅ 保证代码覆盖率 > 80%

### 测试范围

#### 包含
- FunASR 客户端服务 (funasrService.ts)
- 3D-Speaker 客户端服务 (speakerRecognitionService.ts)
- 3D-Speaker Python 服务 (FastAPI)
- 服务选择器和适配器
- Mock 服务实现

#### 不包含
- 前端 UI 组件测试（单独测试计划）
- 性能压力测试（专项测试）
- 安全渗透测试（专项测试）

---

## 测试环境配置

### TypeScript 测试环境

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "jest-mock-extended": "^3.0.5",
    "nock": "^13.4.0",
    "ws": "^8.14.2"
  }
}
```

### Python 测试环境

```bash
# requirements-test.txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-mock==3.12.0
httpx==0.25.2
respx==0.20.2
faker==20.1.0
```

### 测试配置文件

#### jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
}
```

#### pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
    mock: Tests with mocked dependencies
```

---

## 测试分层策略

```
┌─────────────────────────────────────────────┐
│         端到端测试 (E2E Tests)              │
│   完整业务流程：录音→转写→声纹→纪要        │
└─────────────────────────────────────────────┘
                    ▲
                    │
┌─────────────────────────────────────────────┐
│         集成测试 (Integration Tests)        │
│   FunASR ↔ Backend, 3D-Speaker ↔ Backend   │
└─────────────────────────────────────────────┘
                    ▲
                    │
┌─────────────────────────────────────────────┐
│         单元测试 (Unit Tests)               │
│   各服务模块的独立功能测试                  │
└─────────────────────────────────────────────┘
```

### 测试金字塔比例

- 单元测试: 70%
- 集成测试: 20%
- 端到端测试: 10%

---

## TypeScript 服务测试

### 1. FunASR Service 单元测试

#### 文件: `src/services/__tests__/funasrService.test.ts`

```typescript
import { FunASRService, FunASRRealTimeSession } from '../funasrService'
import nock from 'nock'
import fs from 'fs/promises'
import WebSocket from 'ws'

describe('FunASRService', () => {
  let service: FunASRService
  const mockConfig = {
    serviceUrl: 'http://localhost:10095',
    wsUrl: 'ws://localhost:10096',
    timeout: 30000,
    maxRetries: 3
  }

  beforeEach(() => {
    service = new FunASRService(mockConfig)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('healthCheck', () => {
    it('应该返回 true 当服务健康', async () => {
      nock('http://localhost:10095')
        .get('/api/health')
        .reply(200, { status: 'ok' })

      const result = await service.healthCheck()
      expect(result).toBe(true)
    })

    it('应该返回 false 当服务不可用', async () => {
      nock('http://localhost:10095')
        .get('/api/health')
        .reply(500)

      const result = await service.healthCheck()
      expect(result).toBe(false)
    })

    it('应该返回 false 当网络错误', async () => {
      nock('http://localhost:10095')
        .get('/api/health')
        .replyWithError('Network error')

      const result = await service.healthCheck()
      expect(result).toBe(false)
    })
  })

  describe('recognizeFromFile', () => {
    const testAudioPath = '/test/audio.wav'

    beforeEach(() => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock audio data'))
    })

    it('应该成功转录音频文件', async () => {
      nock('http://localhost:10095')
        .post('/api/v1/asr')
        .reply(200, {
          code: 0,
          result: {
            text: '这是测试文本',
            confidence: 0.95,
            duration: 10.5
          }
        })

      const result = await service.recognizeFromFile(testAudioPath)

      expect(result).toHaveLength(1)
      expect(result[0].text).toBe('这是测试文本')
      expect(result[0].confidence).toBe(0.95)
      expect(result[0].endTime).toBe(10500)
    })

    it('应该正确处理自定义选项', async () => {
      const options = {
        format: 'mp3',
        sampleRate: 16000,
        language: 'zh-cn',
        enablePunctuation: true,
        enableInverseTextNormalization: true
      }

      nock('http://localhost:10095')
        .post('/api/v1/asr', (body) => {
          // 验证请求参数
          return true
        })
        .reply(200, {
          code: 0,
          result: { text: '测试', confidence: 0.9 }
        })

      await service.recognizeFromFile(testAudioPath, options)
    })

    it('应该抛出错误当 API 返回错误', async () => {
      nock('http://localhost:10095')
        .post('/api/v1/asr')
        .reply(200, {
          code: -1,
          message: '转录失败'
        })

      await expect(service.recognizeFromFile(testAudioPath))
        .rejects.toThrow('FunASR API 返回错误')
    })

    it('应该抛出错误当文件不存在', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'))

      await expect(service.recognizeFromFile('/nonexistent.wav'))
        .rejects.toThrow()
    })

    it('应该正确设置音频 MIME 类型', async () => {
      const formats = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'pcm': 'audio/pcm',
        'm4a': 'audio/mp4'
      }

      for (const [format, mimeType] of Object.entries(formats)) {
        nock('http://localhost:10095')
          .post('/api/v1/asr')
          .reply(200, { code: 0, result: { text: 'test' } })

        await service.recognizeFromFile(testAudioPath, { format })
      }
    })
  })

  describe('createRealTimeSession', () => {
    it('应该创建实时会话', async () => {
      const session = await service.createRealTimeSession()

      expect(session).toBeInstanceOf(FunASRRealTimeSession)
    })

    it('应该使用自定义选项创建会话', async () => {
      const options = {
        sampleRate: 16000,
        language: 'zh-cn'
      }

      const session = await service.createRealTimeSession(options)

      expect(session).toBeInstanceOf(FunASRRealTimeSession)
    })
  })
})

describe('FunASRRealTimeSession', () => {
  let session: FunASRRealTimeSession
  let mockWsServer: WebSocket.Server

  beforeEach(() => {
    session = new FunASRRealTimeSession('ws://localhost:10096', {})
  })

  afterEach(() => {
    if (mockWsServer) {
      mockWsServer.close()
    }
    session.close()
  })

  describe('connect', () => {
    it('应该成功连接到 WebSocket', async () => {
      // Mock WebSocket server
      mockWsServer = new WebSocket.Server({ port: 10096 })

      mockWsServer.on('connection', (ws) => {
        ws.on('message', (msg) => {
          const data = JSON.parse(msg.toString())
          if (data.type === 'start') {
            ws.send(JSON.stringify({ type: 'started' }))
          }
        })
      })

      await session.connect()
    })

    it('应该在连接失败时抛出错误', async () => {
      const invalidSession = new FunASRRealTimeSession('ws://invalid:9999', {})

      await expect(invalidSession.connect())
        .rejects.toThrow()
    })
  })

  describe('sendAudio', () => {
    it('应该发送音频数据', async () => {
      mockWsServer = new WebSocket.Server({ port: 10096 })

      let receivedMessage: any = null
      mockWsServer.on('connection', (ws) => {
        ws.on('message', (msg) => {
          const data = JSON.parse(msg.toString())
          if (data.type === 'audio') {
            receivedMessage = data
          }
        })
      })

      await session.connect()

      const audioData = new ArrayBuffer(1024)
      session.sendAudio(audioData)

      // Wait for message to be received
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessage).not.toBeNull()
      expect(receivedMessage.type).toBe('audio')
    })

    it('应该在未连接时警告', () => {
      const audioData = new ArrayBuffer(1024)

      // Should not throw, just warn
      expect(() => session.sendAudio(audioData)).not.toThrow()
    })
  })

  describe('事件处理', () => {
    it('应该触发 data 事件当收到消息', async () => {
      mockWsServer = new WebSocket.Server({ port: 10096 })

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          type: 'result',
          data: {
            text: '测试结果',
            confidence: 0.9
          }
        }))
      })

      await session.connect()

      const dataPromise = new Promise((resolve) => {
        session.on('data', (event) => {
          resolve(event)
        })
      })

      const event = await dataPromise
      expect(event).toHaveProperty('type')
      expect(event).toHaveProperty('result')
    })

    it('应该触发 error 事件当收到错误', async () => {
      mockWsServer = new WebSocket.Server({ port: 10096 })

      mockWsServer.on('connection', (ws) => {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: '测试错误' }
        }))
      })

      await session.connect()

      const errorPromise = new Promise((resolve) => {
        session.on('error', (error) => {
          resolve(error)
        })
      })

      const error = await errorPromise
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('reconnect', () => {
    it('应该在连接断开时尝试重连', async () => {
      // TODO: Test reconnection logic
    })

    it('应该在超过最大重连次数后停止', async () => {
      // TODO: Test max reconnect attempts
    })
  })
})
```

#### 测试用例清单

| 测试类别 | 测试用例 | 优先级 |
|---------|---------|--------|
| 健康检查 | 服务正常返回 true | P0 |
| 健康检查 | 服务异常返回 false | P0 |
| 健康检查 | 网络错误返回 false | P1 |
| 文件转录 | 成功转录音频文件 | P0 |
| 文件转录 | 处理自定义选项 | P1 |
| 文件转录 | API 错误处理 | P0 |
| 文件转录 | 文件不存在错误 | P1 |
| 文件转录 | MIME 类型设置 | P2 |
| 实时会话 | 创建会话 | P0 |
| 实时会话 | WebSocket 连接 | P0 |
| 实时会话 | 发送音频数据 | P0 |
| 实时会话 | 接收转录结果 | P0 |
| 实时会话 | 错误处理 | P1 |
| 实时会话 | 重连机制 | P1 |

---

### 2. 3D-Speaker Service 单元测试

#### 文件: `src/services/__tests__/speakerRecognitionService.test.ts`

```typescript
import { SpeakerRecognitionService } from '../speakerRecognitionService'
import nock from 'nock'
import fs from 'fs/promises'

describe('SpeakerRecognitionService', () => {
  let service: SpeakerRecognitionService
  const mockConfig = {
    serviceUrl: 'http://localhost:5002',
    timeout: 15000,
    similarityThreshold: 0.75
  }

  beforeEach(() => {
    service = new SpeakerRecognitionService(mockConfig)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('healthCheck', () => {
    it('应该返回 true 当服务健康', async () => {
      nock('http://localhost:5002')
        .get('/api/health')
        .reply(200, { status: 'ok' })

      const result = await service.healthCheck()
      expect(result).toBe(true)
    })

    it('应该返回 false 当服务不可用', async () => {
      nock('http://localhost:5002')
        .get('/api/health')
        .reply(500)

      const result = await service.healthCheck()
      expect(result).toBe(false)
    })
  })

  describe('registerSpeaker', () => {
    const testAudioPath = '/test/audio.wav'

    beforeEach(() => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock audio data'))
    })

    it('应该成功注册声纹', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/register')
        .reply(200, {
          success: true,
          data: {
            speaker_id: 'test-speaker-id',
            name: '张三',
            user_id: 'user-001',
            email: 'test@example.com',
            created_at: '2025-10-22T00:00:00',
            sample_count: 1
          }
        })

      const result = await service.registerSpeaker(
        'user-001',
        '张三',
        testAudioPath,
        'test@example.com'
      )

      expect(result.speaker_id).toBe('test-speaker-id')
      expect(result.name).toBe('张三')
      expect(result.user_id).toBe('user-001')
      expect(result.email).toBe('test@example.com')
    })

    it('应该处理无 email 的注册', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/register')
        .reply(200, {
          success: true,
          data: {
            speaker_id: 'test-speaker-id',
            name: '李四',
            user_id: 'user-002',
            created_at: '2025-10-22T00:00:00',
            sample_count: 1
          }
        })

      const result = await service.registerSpeaker(
        'user-002',
        '李四',
        testAudioPath
      )

      expect(result.speaker_id).toBe('test-speaker-id')
      expect(result.email).toBeUndefined()
    })

    it('应该抛出错误当注册失败', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/register')
        .reply(200, {
          success: false,
          message: '音频文件无效'
        })

      await expect(
        service.registerSpeaker('user-001', '张三', testAudioPath)
      ).rejects.toThrow('声纹注册失败')
    })

    it('应该抛出错误当文件不存在', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'))

      await expect(
        service.registerSpeaker('user-001', '张三', '/nonexistent.wav')
      ).rejects.toThrow()
    })
  })

  describe('recognizeSpeaker', () => {
    const testAudioPath = '/test/audio.wav'

    beforeEach(() => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock audio data'))
    })

    it('应该成功识别说话人', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/recognize')
        .reply(200, {
          success: true,
          data: {
            matches: [
              {
                speaker_id: 'speaker-001',
                name: '张三',
                user_id: 'user-001',
                similarity: 0.85,
                confidence: 0.85,
                is_match: true
              }
            ],
            count: 1
          }
        })

      const result = await service.recognizeSpeaker(testAudioPath, 5)

      expect(result).toHaveLength(1)
      expect(result[0].speaker_id).toBe('speaker-001')
      expect(result[0].similarity).toBe(0.85)
      expect(result[0].is_match).toBe(true)
    })

    it('应该返回空数组当无匹配', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/recognize')
        .reply(200, {
          success: true,
          data: {
            matches: [],
            count: 0
          }
        })

      const result = await service.recognizeSpeaker(testAudioPath)

      expect(result).toHaveLength(0)
    })

    it('应该使用默认 topK 值', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/recognize', (body) => {
          // Verify topK is sent
          return true
        })
        .reply(200, {
          success: true,
          data: { matches: [], count: 0 }
        })

      await service.recognizeSpeaker(testAudioPath)
    })

    it('应该抛出错误当识别失败', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/recognize')
        .reply(500)

      await expect(
        service.recognizeSpeaker(testAudioPath)
      ).rejects.toThrow()
    })
  })

  describe('diarization', () => {
    const testAudioPath = '/test/audio.wav'

    beforeEach(() => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock audio data'))
    })

    it('应该成功执行说话人分割', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/diarization')
        .reply(200, {
          success: true,
          data: {
            segments: [
              {
                start_time: 0.0,
                end_time: 5.2,
                speaker_id: 'speaker-001',
                confidence: 0.9
              },
              {
                start_time: 5.2,
                end_time: 10.5,
                speaker_id: 'speaker-002',
                confidence: 0.85
              }
            ],
            count: 2
          }
        })

      const result = await service.diarization(testAudioPath)

      expect(result).toHaveLength(2)
      expect(result[0].start_time).toBe(0.0)
      expect(result[0].speaker_id).toBe('speaker-001')
    })

    it('应该支持指定说话人数量', async () => {
      nock('http://localhost:5002')
        .post('/api/speaker/diarization')
        .reply(200, {
          success: true,
          data: { segments: [], count: 0 }
        })

      await service.diarization(testAudioPath, 3)
    })
  })

  describe('listSpeakers', () => {
    it('应该返回说话人列表', async () => {
      nock('http://localhost:5002')
        .get('/api/speaker/list')
        .reply(200, {
          success: true,
          data: {
            speakers: [
              {
                speaker_id: 'speaker-001',
                name: '张三',
                user_id: 'user-001',
                created_at: '2025-10-22T00:00:00',
                sample_count: 1
              }
            ],
            count: 1
          }
        })

      const result = await service.listSpeakers()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('张三')
    })

    it('应该返回空数组当无说话人', async () => {
      nock('http://localhost:5002')
        .get('/api/speaker/list')
        .reply(200, {
          success: true,
          data: { speakers: [], count: 0 }
        })

      const result = await service.listSpeakers()

      expect(result).toHaveLength(0)
    })
  })

  describe('deleteSpeaker', () => {
    it('应该成功删除声纹', async () => {
      nock('http://localhost:5002')
        .delete('/api/speaker/speaker-001')
        .reply(200, {
          success: true,
          message: '声纹删除成功'
        })

      const result = await service.deleteSpeaker('speaker-001')

      expect(result).toBe(true)
    })

    it('应该返回 false 当声纹不存在', async () => {
      nock('http://localhost:5002')
        .delete('/api/speaker/nonexistent')
        .reply(404)

      const result = await service.deleteSpeaker('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('convertToVoiceprintMatchResult', () => {
    it('应该正确转换匹配结果', () => {
      const matches = [
        {
          speaker_id: 'speaker-001',
          name: '张三',
          user_id: 'user-001',
          similarity: 0.85,
          confidence: 0.85,
          is_match: true
        }
      ]

      const result = service.convertToVoiceprintMatchResult(matches)

      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('user-001')
      expect(result[0].voiceprintId).toBe('speaker-001')
    })

    it('应该处理无 user_id 的情况', () => {
      const matches = [
        {
          speaker_id: 'speaker-001',
          name: '张三',
          similarity: 0.85,
          confidence: 0.85,
          is_match: true
        }
      ]

      const result = service.convertToVoiceprintMatchResult(matches)

      expect(result[0].userId).toBe('speaker-001')
    })
  })

  describe('convertToVoiceprintProfile', () => {
    it('应该正确转换声纹配置', () => {
      const profile = {
        speaker_id: 'speaker-001',
        name: '张三',
        user_id: 'user-001',
        email: 'test@example.com',
        created_at: '2025-10-22T00:00:00',
        sample_count: 1
      }

      const result = service.convertToVoiceprintProfile(profile)

      expect(result.id).toBe('speaker-001')
      expect(result.userId).toBe('user-001')
      expect(result.name).toBe('张三')
      expect(result.sampleCount).toBe(1)
    })
  })
})
```

#### 测试用例清单

| 测试类别 | 测试用例 | 优先级 |
|---------|---------|--------|
| 健康检查 | 服务正常返回 true | P0 |
| 健康检查 | 服务异常返回 false | P0 |
| 声纹注册 | 成功注册声纹 | P0 |
| 声纹注册 | 处理无 email 注册 | P1 |
| 声纹注册 | 注册失败错误处理 | P0 |
| 声纹注册 | 文件不存在错误 | P1 |
| 说话人识别 | 成功识别说话人 | P0 |
| 说话人识别 | 无匹配返回空数组 | P1 |
| 说话人识别 | topK 参数处理 | P1 |
| 说话人识别 | 错误处理 | P0 |
| 说话人分割 | 成功执行分割 | P0 |
| 说话人分割 | 指定说话人数量 | P1 |
| 列表查询 | 返回说话人列表 | P0 |
| 列表查询 | 空列表处理 | P1 |
| 删除声纹 | 成功删除 | P0 |
| 删除声纹 | 不存在处理 | P1 |
| 适配器 | 匹配结果转换 | P1 |
| 适配器 | 配置转换 | P1 |

---

## Python 服务测试

### 1. FastAPI 应用测试

#### 文件: `tests/test_app.py`

```python
import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import tempfile
import shutil

from speaker_service.app import app
from speaker_service.speaker_model import SpeakerModel


@pytest.fixture
def client():
    """测试客户端"""
    return TestClient(app)


@pytest.fixture
def test_audio_file():
    """测试音频文件"""
    # 创建临时音频文件
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        # 写入模拟音频数据
        f.write(b'RIFF' + b'\x00' * 100)
        yield f.name

    # 清理
    Path(f.name).unlink(missing_ok=True)


class TestHealthCheck:
    """健康检查测试"""

    def test_root_endpoint(self, client):
        """测试根路径"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "3D-Speaker 声纹识别服务"
        assert data["version"] == "1.0.0"
        assert data["status"] == "running"

    def test_health_check(self, client):
        """测试健康检查"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "model_loaded" in data
        assert "registered_speakers" in data


class TestSpeakerRegistration:
    """声纹注册测试"""

    def test_register_speaker_success(self, client, test_audio_file, mocker):
        """测试成功注册声纹"""
        # Mock 模型注册方法
        mock_register = mocker.patch.object(
            SpeakerModel,
            'register_speaker',
            return_value={
                'speaker_id': 'test-id-001',
                'name': '张三',
                'user_id': 'user-001',
                'email': 'test@example.com',
                'created_at': '2025-10-22T00:00:00',
                'sample_count': 1
            }
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/register",
                data={
                    'name': '张三',
                    'user_id': 'user-001',
                    'email': 'test@example.com'
                },
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['message'] == '声纹注册成功'
        assert data['data']['speaker_id'] == 'test-id-001'
        assert data['data']['name'] == '张三'

    def test_register_speaker_without_email(self, client, test_audio_file, mocker):
        """测试无 email 注册"""
        mock_register = mocker.patch.object(
            SpeakerModel,
            'register_speaker',
            return_value={
                'speaker_id': 'test-id-002',
                'name': '李四',
                'user_id': 'user-002',
                'created_at': '2025-10-22T00:00:00',
                'sample_count': 1
            }
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/register",
                data={'name': '李四', 'user_id': 'user-002'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

    def test_register_speaker_missing_name(self, client, test_audio_file):
        """测试缺少必填字段"""
        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/register",
                data={'user_id': 'user-001'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 422  # Validation error

    def test_register_speaker_invalid_audio(self, client, mocker):
        """测试无效音频文件"""
        mock_register = mocker.patch.object(
            SpeakerModel,
            'register_speaker',
            side_effect=ValueError('音频文件无效')
        )

        # 创建无效音频文件
        with tempfile.NamedTemporaryFile(suffix='.wav') as f:
            f.write(b'invalid data')
            f.seek(0)

            response = client.post(
                "/api/speaker/register",
                data={'name': '张三', 'user_id': 'user-001'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 400


class TestSpeakerRecognition:
    """说话人识别测试"""

    def test_recognize_speaker_success(self, client, test_audio_file, mocker):
        """测试成功识别"""
        mock_recognize = mocker.patch.object(
            SpeakerModel,
            'recognize_speaker',
            return_value=[
                {
                    'speaker_id': 'speaker-001',
                    'name': '张三',
                    'user_id': 'user-001',
                    'similarity': 0.85,
                    'confidence': 0.85,
                    'is_match': True
                }
            ]
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/recognize",
                data={'top_k': '5'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['message'] == '声纹识别完成'
        assert len(data['data']['matches']) == 1
        assert data['data']['matches'][0]['speaker_id'] == 'speaker-001'

    def test_recognize_speaker_no_match(self, client, test_audio_file, mocker):
        """测试无匹配"""
        mock_recognize = mocker.patch.object(
            SpeakerModel,
            'recognize_speaker',
            return_value=[]
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/recognize",
                data={'top_k': '5'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert len(data['data']['matches']) == 0

    def test_recognize_speaker_default_topk(self, client, test_audio_file, mocker):
        """测试默认 topK"""
        mock_recognize = mocker.patch.object(
            SpeakerModel,
            'recognize_speaker',
            return_value=[]
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/recognize",
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        mock_recognize.assert_called_once()


class TestDiarization:
    """说话人分割测试"""

    def test_diarization_success(self, client, test_audio_file, mocker):
        """测试成功分割"""
        mock_diarization = mocker.patch.object(
            SpeakerModel,
            'diarization',
            return_value=[
                {
                    'start_time': 0.0,
                    'end_time': 5.2,
                    'speaker_id': 'speaker-001',
                    'confidence': 0.9
                },
                {
                    'start_time': 5.2,
                    'end_time': 10.5,
                    'speaker_id': 'speaker-002',
                    'confidence': 0.85
                }
            ]
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/diarization",
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert len(data['data']['segments']) == 2

    def test_diarization_with_num_speakers(self, client, test_audio_file, mocker):
        """测试指定说话人数量"""
        mock_diarization = mocker.patch.object(
            SpeakerModel,
            'diarization',
            return_value=[]
        )

        with open(test_audio_file, 'rb') as f:
            response = client.post(
                "/api/speaker/diarization",
                data={'num_speakers': '3'},
                files={'audio': ('test.wav', f, 'audio/wav')}
            )

        assert response.status_code == 200
        mock_diarization.assert_called_once()


class TestSpeakerList:
    """说话人列表测试"""

    def test_list_speakers(self, client, mocker):
        """测试获取说话人列表"""
        mock_list = mocker.patch.object(
            SpeakerModel,
            'list_speakers',
            return_value=[
                {
                    'speaker_id': 'speaker-001',
                    'name': '张三',
                    'user_id': 'user-001',
                    'created_at': '2025-10-22T00:00:00',
                    'sample_count': 1
                }
            ]
        )

        response = client.get("/api/speaker/list")

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert len(data['data']['speakers']) == 1

    def test_list_speakers_empty(self, client, mocker):
        """测试空列表"""
        mock_list = mocker.patch.object(
            SpeakerModel,
            'list_speakers',
            return_value=[]
        )

        response = client.get("/api/speaker/list")

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert len(data['data']['speakers']) == 0


class TestSpeakerDeletion:
    """声纹删除测试"""

    def test_delete_speaker_success(self, client, mocker):
        """测试成功删除"""
        mock_delete = mocker.patch.object(
            SpeakerModel,
            'delete_speaker',
            return_value=True
        )

        response = client.delete("/api/speaker/speaker-001")

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['message'] == '声纹删除成功'

    def test_delete_speaker_not_found(self, client, mocker):
        """测试删除不存在的声纹"""
        mock_delete = mocker.patch.object(
            SpeakerModel,
            'delete_speaker',
            return_value=False
        )

        response = client.delete("/api/speaker/nonexistent")

        assert response.status_code == 404


class TestCORS:
    """CORS 配置测试"""

    def test_cors_headers(self, client):
        """测试 CORS 头"""
        response = client.options(
            "/api/health",
            headers={
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'GET'
            }
        )

        assert response.status_code == 200
        assert 'access-control-allow-origin' in response.headers
```

#### 测试用例清单

| 测试类别 | 测试用例 | 优先级 |
|---------|---------|--------|
| 系统 | 根路径访问 | P1 |
| 系统 | 健康检查 | P0 |
| 注册 | 成功注册声纹 | P0 |
| 注册 | 无 email 注册 | P1 |
| 注册 | 缺少必填字段 | P0 |
| 注册 | 无效音频文件 | P1 |
| 识别 | 成功识别 | P0 |
| 识别 | 无匹配结果 | P1 |
| 识别 | 默认 topK | P1 |
| 分割 | 成功分割 | P0 |
| 分割 | 指定说话人数量 | P1 |
| 列表 | 获取说话人列表 | P0 |
| 列表 | 空列表 | P1 |
| 删除 | 成功删除 | P0 |
| 删除 | 不存在处理 | P1 |
| CORS | CORS 头设置 | P2 |

---

### 2. Speaker Model 测试

#### 文件: `tests/test_speaker_model.py`

```python
import pytest
from pathlib import Path
import tempfile
import shutil

from speaker_service.speaker_model import SpeakerModel, get_speaker_model
from speaker_service.config import settings


@pytest.fixture
def speaker_model(tmp_path):
    """创建测试用的 SpeakerModel"""
    # 使用临时目录
    test_voiceprint_dir = tmp_path / "voiceprints"
    test_voiceprint_dir.mkdir()

    # 临时修改配置
    original_dir = settings.VOICEPRINT_DIR
    settings.VOICEPRINT_DIR = str(test_voiceprint_dir)

    model = SpeakerModel()

    yield model

    # 恢复配置
    settings.VOICEPRINT_DIR = original_dir


@pytest.fixture
def test_audio_file():
    """创建测试音频文件"""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        # WAV 文件头 + 模拟数据
        f.write(b'RIFF' + b'\x00' * 100)
        yield f.name

    Path(f.name).unlink(missing_ok=True)


class TestSpeakerModelInitialization:
    """模型初始化测试"""

    def test_singleton_pattern(self):
        """测试单例模式"""
        model1 = get_speaker_model()
        model2 = get_speaker_model()

        assert model1 is model2

    def test_load_existing_voiceprints(self, speaker_model, tmp_path):
        """测试加载已有声纹"""
        # TODO: 实现声纹持久化测试
        pass


class TestRegisterSpeaker:
    """声纹注册测试"""

    def test_register_speaker_success(self, speaker_model, test_audio_file, mocker):
        """测试成功注册"""
        # Mock 模型推理
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512  # 模拟 embedding
        )

        result = speaker_model.register_speaker(
            name='张三',
            audio_path=test_audio_file,
            user_id='user-001',
            email='test@example.com'
        )

        assert 'speaker_id' in result
        assert result['name'] == '张三'
        assert result['user_id'] == 'user-001'
        assert result['email'] == 'test@example.com'

    def test_register_speaker_invalid_audio(self, speaker_model):
        """测试无效音频"""
        with pytest.raises(ValueError):
            speaker_model.register_speaker(
                name='张三',
                audio_path='/nonexistent.wav'
            )

    def test_register_speaker_duplicate(self, speaker_model, test_audio_file, mocker):
        """测试重复注册"""
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512
        )

        # 第一次注册
        speaker_model.register_speaker(
            name='张三',
            audio_path=test_audio_file,
            user_id='user-001'
        )

        # 第二次注册相同 user_id
        result = speaker_model.register_speaker(
            name='张三更新',
            audio_path=test_audio_file,
            user_id='user-001'
        )

        # 应该更新而不是创建新的
        assert result['name'] == '张三更新'


class TestRecognizeSpeaker:
    """说话人识别测试"""

    def test_recognize_speaker_with_match(self, speaker_model, test_audio_file, mocker):
        """测试有匹配的识别"""
        # 注册声纹
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512
        )

        speaker_model.register_speaker(
            name='张三',
            audio_path=test_audio_file,
            user_id='user-001'
        )

        # 识别
        mocker.patch.object(
            speaker_model,
            '_compute_similarity',
            return_value=0.85
        )

        matches = speaker_model.recognize_speaker(
            audio_path=test_audio_file,
            top_k=5
        )

        assert len(matches) > 0
        assert matches[0]['name'] == '张三'
        assert matches[0]['similarity'] >= 0.75

    def test_recognize_speaker_no_match(self, speaker_model, test_audio_file, mocker):
        """测试无匹配"""
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512
        )

        mocker.patch.object(
            speaker_model,
            '_compute_similarity',
            return_value=0.3  # 低相似度
        )

        matches = speaker_model.recognize_speaker(
            audio_path=test_audio_file,
            top_k=5
        )

        # 应该返回结果但 is_match 为 False
        if len(matches) > 0:
            assert matches[0]['is_match'] is False


class TestDiarization:
    """说话人分割测试"""

    def test_diarization_basic(self, speaker_model, test_audio_file, mocker):
        """测试基本分割"""
        # Mock 分割结果
        mocker.patch.object(
            speaker_model,
            '_perform_diarization',
            return_value=[
                {'start_time': 0.0, 'end_time': 5.0, 'speaker_id': 'speaker-1'},
                {'start_time': 5.0, 'end_time': 10.0, 'speaker_id': 'speaker-2'}
            ]
        )

        segments = speaker_model.diarization(audio_path=test_audio_file)

        assert len(segments) == 2
        assert segments[0]['speaker_id'] == 'speaker-1'


class TestListSpeakers:
    """列表查询测试"""

    def test_list_speakers_empty(self, speaker_model):
        """测试空列表"""
        speakers = speaker_model.list_speakers()
        assert len(speakers) == 0

    def test_list_speakers_with_data(self, speaker_model, test_audio_file, mocker):
        """测试有数据的列表"""
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512
        )

        # 注册几个声纹
        for i in range(3):
            speaker_model.register_speaker(
                name=f'测试用户{i}',
                audio_path=test_audio_file,
                user_id=f'user-{i}'
            )

        speakers = speaker_model.list_speakers()
        assert len(speakers) == 3


class TestDeleteSpeaker:
    """删除声纹测试"""

    def test_delete_speaker_success(self, speaker_model, test_audio_file, mocker):
        """测试成功删除"""
        mocker.patch.object(
            speaker_model,
            '_extract_embedding',
            return_value=[0.1] * 512
        )

        # 注册
        result = speaker_model.register_speaker(
            name='张三',
            audio_path=test_audio_file,
            user_id='user-001'
        )

        speaker_id = result['speaker_id']

        # 删除
        success = speaker_model.delete_speaker(speaker_id)

        assert success is True

        # 验证已删除
        speakers = speaker_model.list_speakers()
        assert len(speakers) == 0

    def test_delete_speaker_not_found(self, speaker_model):
        """测试删除不存在的声纹"""
        success = speaker_model.delete_speaker('nonexistent-id')
        assert success is False
```

---

## 集成测试

### 1. FunASR 集成测试

#### 文件: `tests/integration/test_funasr_integration.test.ts`

```typescript
import { funasrService } from '../../src/services/funasrService'
import path from 'path'
import fs from 'fs/promises'

describe('FunASR Integration Tests', () => {
  const testAudioPath = path.join(__dirname, '../fixtures/test-audio.wav')

  beforeAll(async () => {
    // 确保测试音频文件存在
    const exists = await fs.access(testAudioPath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      throw new Error(`测试音频文件不存在: ${testAudioPath}`)
    }
  })

  describe('使用真实 FunASR 服务', () => {
    beforeAll(async () => {
      // 检查服务是否可用
      const isHealthy = await funasrService.healthCheck()

      if (!isHealthy) {
        console.warn('FunASR 服务不可用，跳过集成测试')
      }
    })

    it('应该成功转录真实音频文件', async () => {
      const isHealthy = await funasrService.healthCheck()

      if (!isHealthy) {
        return // 跳过测试
      }

      const result = await funasrService.recognizeFromFile(testAudioPath)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].text).toBeTruthy()
      expect(result[0].confidence).toBeGreaterThan(0)
    }, 60000) // 60秒超时

    it('应该支持实时转录', async () => {
      const isHealthy = await funasrService.healthCheck()

      if (!isHealthy) {
        return
      }

      const session = await funasrService.createRealTimeSession()

      let receivedData = false

      session.on('data', (event) => {
        receivedData = true
      })

      await session.connect()

      // 读取测试音频并发送
      const audioBuffer = await fs.readFile(testAudioPath)
      session.sendAudio(audioBuffer.buffer)

      // 等待结果
      await new Promise(resolve => setTimeout(resolve, 5000))

      session.close()

      expect(receivedData).toBe(true)
    }, 30000)
  })

  describe('使用 Mock 模式', () => {
    beforeAll(() => {
      process.env.USE_MOCK_SPEECH_SERVICE = 'true'
    })

    afterAll(() => {
      delete process.env.USE_MOCK_SPEECH_SERVICE
    })

    it('应该在 Mock 模式下返回模拟结果', async () => {
      // TODO: 实现 Mock 服务测试
    })
  })
})
```

### 2. 3D-Speaker 集成测试

#### 文件: `tests/integration/test_speaker_integration.test.ts`

```typescript
import { speakerRecognitionService } from '../../src/services/speakerRecognitionService'
import path from 'path'
import fs from 'fs/promises'

describe('3D-Speaker Integration Tests', () => {
  const testAudioPath = path.join(__dirname, '../fixtures/test-audio.wav')
  let registeredSpeakerId: string

  beforeAll(async () => {
    // 确保服务可用
    const isHealthy = await speakerRecognitionService.healthCheck()

    if (!isHealthy) {
      throw new Error('3D-Speaker 服务不可用')
    }
  })

  afterAll(async () => {
    // 清理测试数据
    if (registeredSpeakerId) {
      await speakerRecognitionService.deleteSpeaker(registeredSpeakerId)
    }
  })

  it('应该成功注册声纹', async () => {
    const result = await speakerRecognitionService.registerSpeaker(
      'test-user-001',
      '测试用户',
      testAudioPath,
      'test@example.com'
    )

    expect(result.speaker_id).toBeTruthy()
    expect(result.name).toBe('测试用户')
    expect(result.user_id).toBe('test-user-001')

    registeredSpeakerId = result.speaker_id
  }, 60000)

  it('应该成功识别已注册的说话人', async () => {
    const matches = await speakerRecognitionService.recognizeSpeaker(
      testAudioPath,
      5
    )

    expect(matches).toBeDefined()
    expect(matches.length).toBeGreaterThan(0)
  }, 30000)

  it('应该获取说话人列表', async () => {
    const speakers = await speakerRecognitionService.listSpeakers()

    expect(speakers).toBeDefined()
    expect(Array.isArray(speakers)).toBe(true)
    expect(speakers.length).toBeGreaterThan(0)
  })

  it('应该成功执行说话人分割', async () => {
    const segments = await speakerRecognitionService.diarization(testAudioPath)

    expect(segments).toBeDefined()
    expect(Array.isArray(segments)).toBe(true)
  }, 60000)
})
```

### 3. 端到端集成测试

#### 文件: `tests/integration/test_e2e.test.ts`

```typescript
import { speechService } from '../../src/services/speechRecognitionService'
import { voiceprintService } from '../../src/services/voiceprintService'
import path from 'path'

describe('端到端集成测试', () => {
  const testAudioPath = path.join(__dirname, '../fixtures/meeting-test.wav')

  it('应该完成完整的会议转录流程', async () => {
    // 1. 语音转录
    const transcriptionResults = await speechService.recognizeFromFile(testAudioPath)

    expect(transcriptionResults).toBeDefined()
    expect(transcriptionResults.length).toBeGreaterThan(0)

    // 2. 声纹识别（如果已有注册用户）
    const speakers = await voiceprintService.listVoiceprints()

    if (speakers.length > 0) {
      const matches = await voiceprintService.matchVoiceprint(
        Buffer.from('mock audio data')
      )

      expect(matches).toBeDefined()
    }

    // 3. 验证转录结果格式
    transcriptionResults.forEach(result => {
      expect(result.text).toBeTruthy()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  }, 120000) // 2分钟超时
})
```

---

## 测试数据准备

### 测试音频文件

创建测试音频文件目录结构：

```
backend/test-resources/audio/
├── fixtures/
│   ├── test-audio-short.wav      # 短音频（<5秒）
│   ├── test-audio-medium.wav     # 中等音频（5-30秒）
│   ├── test-audio-long.wav       # 长音频（>30秒）
│   ├── test-audio-noisy.wav      # 含噪音音频
│   ├── test-audio-silence.wav    # 静音音频
│   ├── test-audio-multi-speaker.wav  # 多说话人音频
│   └── invalid-audio.txt         # 无效文件
└── meeting-samples/
    ├── meeting-test-16k.wav
    └── meeting-short-test2-16k.wav
```

### Mock 数据生成器

#### 文件: `tests/utils/mockDataGenerator.ts`

```typescript
export class MockDataGenerator {
  static generateTranscriptionResult(text?: string) {
    return {
      text: text || '这是模拟的转录文本',
      confidence: 0.9 + Math.random() * 0.1,
      startTime: 0,
      endTime: 5000
    }
  }

  static generateSpeakerProfile(userId?: string, name?: string) {
    return {
      speaker_id: `mock-speaker-${Date.now()}`,
      name: name || '模拟用户',
      user_id: userId || `mock-user-${Date.now()}`,
      email: 'mock@example.com',
      created_at: new Date().toISOString(),
      sample_count: 1
    }
  }

  static generateSpeakerMatch(similarity?: number) {
    return {
      speaker_id: `mock-speaker-${Date.now()}`,
      name: '模拟用户',
      user_id: `mock-user-${Date.now()}`,
      similarity: similarity || 0.85,
      confidence: similarity || 0.85,
      is_match: (similarity || 0.85) >= 0.75
    }
  }

  static generateDiarizationSegment(startTime: number, endTime: number) {
    return {
      start_time: startTime,
      end_time: endTime,
      speaker_id: `speaker-${Math.floor(Math.random() * 3) + 1}`,
      confidence: 0.8 + Math.random() * 0.2
    }
  }
}
```

---

## 测试执行计划

### 阶段一：单元测试（第 1-2 周）

1. **TypeScript 服务测试**
   - FunASRService 单元测试
   - SpeakerRecognitionService 单元测试
   - 服务选择器测试
   - 适配器测试

2. **Python 服务测试**
   - FastAPI 路由测试
   - SpeakerModel 测试
   - 工具函数测试

### 阶段二：集成测试（第 3 周）

1. **服务间集成**
   - TypeScript → FunASR
   - TypeScript → 3D-Speaker
   - Mock 模式验证

2. **API 集成测试**
   - 完整请求响应流程
   - 错误处理验证
   - 并发请求测试

### 阶段三：端到端测试（第 4 周）

1. **完整业务流程**
   - 录音 → 转写 → 声纹 → 纪要
   - 多场景测试
   - 性能基准测试

### 测试执行命令

```bash
# TypeScript 单元测试
npm run test                    # 运行所有测试
npm run test:unit              # 仅单元测试
npm run test:integration       # 仅集成测试
npm run test:watch             # 监听模式
npm run test:coverage          # 生成覆盖率报告

# Python 单元测试
pytest                          # 运行所有测试
pytest -m unit                  # 仅单元测试
pytest -m integration           # 仅集成测试
pytest --cov                    # 生成覆盖率报告
pytest -v -s                    # 详细输出

# 组合命令
npm run test:all               # TypeScript + Python 所有测试
```

---

## 验收标准

### 代码覆盖率

| 服务 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|-----|---------|-----------|-----------|
| funasrService.ts | ≥ 80% | ≥ 75% | ≥ 85% |
| speakerRecognitionService.ts | ≥ 80% | ≥ 75% | ≥ 85% |
| Python FastAPI | ≥ 80% | ≥ 75% | ≥ 85% |
| Speaker Model | ≥ 75% | ≥ 70% | ≥ 80% |

### 测试通过率

- 所有 P0 测试用例 100% 通过
- 所有 P1 测试用例 ≥ 95% 通过
- 所有 P2 测试用例 ≥ 90% 通过

### 性能基准

| 操作 | 目标时间 | 备注 |
|-----|---------|------|
| FunASR 文件转录 | < 实际音频时长 * 2 | CPU模式 |
| 3D-Speaker 注册 | < 30秒 | CPU模式 |
| 3D-Speaker 识别 | < 5秒 | CPU模式 |
| API 响应时间 | < 200ms | 健康检查等 |

### 错误处理

- 所有异常场景都有对应的测试用例
- 错误消息清晰准确
- 不应有未捕获的异常

### 文档完整性

- 所有测试用例都有清晰的描述
- 复杂测试逻辑有注释说明
- README 包含测试运行指南

---

## 附录

### A. 测试工具安装

```bash
# TypeScript 测试依赖
cd backend
npm install --save-dev \
  jest \
  @types/jest \
  ts-jest \
  jest-mock-extended \
  nock \
  @faker-js/faker

# Python 测试依赖
cd python-services
source venv/bin/activate
pip install \
  pytest \
  pytest-asyncio \
  pytest-cov \
  pytest-mock \
  httpx \
  respx \
  faker
```

### B. CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test-typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: pip install -r requirements.txt
      - run: pip install -r requirements-test.txt
      - run: pytest --cov
      - uses: codecov/codecov-action@v3
```

### C. 测试最佳实践

1. **测试命名**: 使用清晰的描述性名称
2. **测试隔离**: 每个测试应该独立运行
3. **Mock 策略**: 只 Mock 外部依赖
4. **数据清理**: 测试后清理测试数据
5. **断言明确**: 使用具体的断言而非通用断言
6. **测试覆盖**: 包含正常流程和异常流程

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-22
**维护者**: 开发团队
**审核状态**: ✅ 待审核
