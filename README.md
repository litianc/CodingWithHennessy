# 智能会议纪要 Agent

基于AI技术的智能会议记录和分析系统，结合开源模型和云服务，提供实时语音转录、声纹识别、智能纪要生成等功能。

## 🎯 项目概述

### 核心功能
- **实时语音转录** - FunASR开源模型 + 实时WebSocket推送
- **智能声纹识别** - 3D-Speaker声纹识别引擎（注册、识别、说话人分割）
- **AI纪要生成** - DeepSeek V3 API智能分析生成结构化纪要
- **多轮对话优化** - AI对话式优化纪要内容和格式
- **自动化邮件** - 智能识别参会者，自动发送会议纪要
- **多说话人转录** - 实时识别和标注不同说话人的发言

### 技术亮点
- **本地化语音识别** - 基于FunASR的Docker部署，无需依赖云服务API
- **高精度声纹识别** - 使用阿里巴巴3D-Speaker模型，支持快速注册和实时识别
- **混合架构设计** - Node.js后端 + Python AI服务，发挥各自优势
- **实时响应体验** - WebSocket全双工通信，毫秒级数据推送
- **灵活部署方案** - 支持Docker容器化部署，一键启动所有服务

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                       智能会议纪要Agent系统架构                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────┐      ┌─────────────────────┐              │
│   │   React Frontend    │      │   Node.js Backend   │              │
│   │  ┌──────────────┐   │      │  ┌──────────────┐   │              │
│   │  │ Ant Design   │   │◄────►│  │   Express    │   │              │
│   │  │ Framer Motion│   │      │  │  Socket.IO   │   │              │
│   │  │  Zustand     │   │      │  │  TypeScript  │   │              │
│   │  └──────────────┘   │      │  └──────────────┘   │              │
│   └─────────────────────┘      └──────────┬──────────┘              │
│         Port: 3000                         │                         │
│                                           │                         │
│   ┌────────────────────────────────────────┴──────────────────┐     │
│   │                    业务服务层                              │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │     │
│   │  │ Meeting  │  │Recording │  │ Minutes  │  │ Email    │  │     │
│   │  │ Service  │  │ Service  │  │ Service  │  │ Service  │  │     │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │                  AI & 语音处理服务                          │     │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │     │
│   │  │   FunASR     │  │ 3D-Speaker   │  │  DeepSeek    │    │     │
│   │  │   Docker     │  │ FastAPI/Py   │  │   API        │    │     │
│   │  │ Port: 10095  │  │ Port: 5002   │  │  (Cloud)     │    │     │
│   │  └──────────────┘  └──────────────┘  └──────────────┘    │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │                    数据存储层                              │     │
│   │  ┌──────────────┐           ┌──────────────┐              │     │
│   │  │   MongoDB    │           │    Redis     │              │     │
│   │  │   Docker     │           │   Docker     │              │     │
│   │  │ Port: 27017  │           │ Port: 6379   │              │     │
│   │  └──────────────┘           └──────────────┘              │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 💻 技术栈

### 前端技术
- **框架**: React 18 + TypeScript + Vite
- **UI组件库**: Ant Design 5
- **状态管理**: Zustand
- **动画**: Framer Motion
- **实时通信**: Socket.IO Client
- **样式**: TailwindCSS + PostCSS
- **Markdown渲染**: react-markdown + remark-gfm

### 后端技术
- **运行时**: Node.js 18+
- **框架**: Express + TypeScript
- **实时通信**: Socket.IO
- **数据库**: MongoDB + Mongoose
- **缓存**: Redis
- **音频处理**: fluent-ffmpeg
- **认证**: JWT + bcrypt
- **日志**: Winston (按日期轮转)
- **安全**: Helmet + express-rate-limit

### AI & 语音服务
- **语音识别**: FunASR (Docker, CPU模式)
- **声纹识别**: 3D-Speaker (FastAPI + Python)
- **AI模型**: DeepSeek V3 API
- **邮件服务**: Nodemailer (SMTP)

### 数据库 & 缓存
- **MongoDB**: 7.0+ (Docker部署)
- **Redis**: 7.2+ (Docker部署)

## 📁 项目结构

```
CodingWithHennessy/
├── frontend/                          # React前端项目
│   ├── src/
│   │   ├── components/                # UI组件
│   │   │   ├── common/                # 通用组件
│   │   │   ├── meeting/               # 会议相关组件
│   │   │   │   ├── AIChat/            # AI对话组件
│   │   │   │   ├── EmailSendModal/    # 邮件发送模态框
│   │   │   │   ├── MeetingControl/    # 会议控制面板
│   │   │   │   ├── MeetingMinutes/    # 会议纪要展示
│   │   │   │   ├── RealTimeTranscription/ # 实时转录
│   │   │   │   └── SpeakerStatistics/ # 说话人统计
│   │   │   └── voiceprint/            # 声纹管理组件
│   │   ├── pages/                     # 页面组件
│   │   │   ├── HomePage/              # 主页
│   │   │   ├── LoginPage/             # 登录页
│   │   │   ├── MeetingPage/           # 会议页面
│   │   │   ├── MeetingListPage/       # 会议列表
│   │   │   ├── MeetingDetailPage/     # 会议详情
│   │   │   ├── SettingsPage/          # 设置页面
│   │   │   └── DemoPage/              # 演示页面
│   │   ├── hooks/                     # 自定义Hooks
│   │   ├── services/                  # API服务
│   │   ├── stores/                    # Zustand状态管理
│   │   ├── types/                     # TypeScript类型定义
│   │   ├── utils/                     # 工具函数
│   │   └── styles/                    # 样式文件
│   └── package.json
│
├── backend/                           # Node.js后端项目
│   ├── src/
│   │   ├── controllers/               # 控制器
│   │   │   ├── authController.ts      # 认证控制器
│   │   │   ├── meetingController.ts   # 会议控制器
│   │   │   ├── recordingController.ts # 录音控制器
│   │   │   ├── transcriptionController.ts # 转录控制器
│   │   │   ├── minutesController.ts   # 纪要控制器
│   │   │   ├── voiceprintController.ts # 声纹控制器
│   │   │   ├── aiController.ts        # AI控制器
│   │   │   ├── emailController.ts     # 邮件控制器
│   │   │   └── fileTransController.ts # 文件转换控制器
│   │   ├── services/                  # 业务服务
│   │   │   ├── aiService.ts           # AI服务（DeepSeek）
│   │   │   ├── audioService.ts        # 音频处理服务
│   │   │   ├── emailService.ts        # 邮件服务
│   │   │   ├── funasrService.ts       # FunASR客户端
│   │   │   ├── funasrWebSocketService.ts # FunASR实时服务
│   │   │   ├── speakerRecognitionService.ts # 声纹识别服务
│   │   │   ├── voiceprintService.ts   # 声纹管理服务
│   │   │   ├── multiSpeakerTranscriptionService.ts # 多说话人转录
│   │   │   ├── minutesGenerationService.ts # 纪要生成服务
│   │   │   └── speechRecognitionService.ts # 语音识别服务
│   │   ├── models/                    # Mongoose数据模型
│   │   ├── middleware/                # Express中间件
│   │   ├── websocket/                 # WebSocket处理器
│   │   ├── routes/                    # API路由
│   │   ├── utils/                     # 工具函数
│   │   ├── validators/                # 数据验证
│   │   └── index.ts                   # 入口文件
│   ├── test-resources/                # 测试资源
│   │   └── audio/                     # 测试音频文件
│   └── package.json
│
├── backend/python-services/           # Python AI服务
│   ├── speaker_service/               # 3D-Speaker声纹服务
│   │   ├── app.py                     # FastAPI应用
│   │   ├── speaker_model.py           # 声纹模型封装
│   │   ├── config.py                  # 配置管理
│   │   └── utils.py                   # 工具函数
│   ├── requirements.txt               # Python依赖
│   ├── setup.sh                       # 安装脚本
│   └── start_speaker_service.sh       # 启动脚本
│
├── docker/                            # Docker配置
│   ├── docker-compose.funasr.yml      # FunASR服务
│   └── funasr/                        # FunASR相关配置
│
├── docs/                              # 项目文档
│   └── index.md                       # 完整设计文档
│
├── logs/                              # 日志目录
├── knowledge/                         # 知识库
├── scripts/                           # 部署脚本
├── docker-compose.yml                 # 生产环境Docker配置
├── docker-compose.dev.yml             # 开发环境Docker配置
├── package.json                       # 项目根配置
├── CLAUDE.md                          # Claude Code指令
├── QUICK_START.md                     # 快速启动指南
└── README.md                          # 项目说明文档
```

## 🚀 快速开始

### 📋 环境要求

- **Node.js**: 18.0.0 或更高版本
- **Python**: 3.8+ (用于3D-Speaker服务)
- **Docker**: 20.10+ (用于FunASR、MongoDB、Redis)
- **Docker Compose**: 1.29+
- **操作系统**: macOS / Linux (推荐) / Windows (WSL2)

### 🎯 一键启动 (推荐)

#### 第一步：准备环境

```bash
# 1. 克隆项目
git clone <repository-url>
cd CodingWithHennessy

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入以下必要配置：
# - DEEPSEEK_API_KEY=your-deepseek-api-key
# - ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id (可选)
# - ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret (可选)

# 3. 安装依赖
npm run install:all
```

#### 第二步：启动AI服务

```bash
# 启动 FunASR 语音识别服务 (Docker)
docker compose -f docker/docker-compose.funasr.yml up -d

# 查看启动日志（首次启动会下载模型，约需5-10分钟）
docker compose -f docker/docker-compose.funasr.yml logs -f

# 等待看到 "Server started" 信息
```

```bash
# 启动 3D-Speaker 声纹识别服务 (Python)
cd backend/python-services

# 运行安装脚本（首次运行）
bash setup.sh

# 启动服务
source venv/bin/activate
uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002 --reload

# 或使用启动脚本
bash start_speaker_service.sh
```

#### 第三步：启动数据库服务

```bash
# 返回项目根目录
cd /root/CodingWithHennessy

# 启动 MongoDB 和 Redis
npm run docker:dev

# 验证服务状态
docker compose -f docker-compose.dev.yml ps
```

#### 第四步：启动应用服务

```bash
# 方式一：同时启动前后端 (推荐)
npm run dev

# 方式二：分别启动
# 终端1: 启动后端服务
npm run dev:backend

# 终端2: 启动前端服务
npm run dev:frontend
```

#### 第五步：验证服务

访问以下地址验证服务是否正常运行：

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:5001/health
- **FunASR服务**: http://localhost:10095/api/health
- **3D-Speaker服务**: http://localhost:5002/api/health
- **3D-Speaker文档**: http://localhost:5002/docs

### 🔧 服务端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| **React Frontend** | 3000 | Web前端界面 |
| **Node.js Backend** | 5001 | 主服务API + WebSocket |
| **3D-Speaker Service** | 5002 | 声纹识别Python服务 |
| **FunASR HTTP** | 10095 | 语音识别HTTP API |
| **FunASR WebSocket** | 10096 | 实时语音识别WebSocket |
| **MongoDB** | 27017 | 数据库服务 |
| **Redis** | 6379 | 缓存服务 |

### 🐳 Docker 部署

#### 开发环境
```bash
# 仅启动数据库服务 (MongoDB + Redis)
npm run docker:dev

# 停止服务
npm run docker:stop

# 清理数据
npm run docker:clean
```

#### 生产环境
```bash
# 配置生产环境变量
cp .env.example .env
# 编辑 .env，填入生产环境配置

# 启动所有服务（包括应用）
npm run docker:prod

# 或使用 docker-compose
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 📝 可用脚本

#### 开发相关
```bash
npm run dev              # 同时启动前后端开发服务器
npm run dev:frontend     # 仅启动前端开发服务器
npm run dev:backend      # 仅启动后端开发服务器
```

#### 构建相关
```bash
npm run build            # 构建前后端项目
npm run build:frontend   # 仅构建前端项目
npm run build:backend    # 仅构建后端项目
```

#### 生产运行
```bash
npm run start            # 启动后端生产服务
npm run start:frontend   # 启动前端生产预览
npm run start:backend    # 启动后端生产服务
```

#### Docker 相关
```bash
npm run docker:dev       # 启动开发环境数据库
npm run docker:prod      # 启动生产环境所有服务
npm run docker:stop      # 停止所有 Docker 服务
npm run docker:clean     # 清理 Docker 数据和容器
```

#### 代码质量
```bash
npm run lint             # 检查代码规范
npm run lint:frontend    # 检查前端代码规范
npm run lint:backend     # 检查后端代码规范
npm run format           # 格式化代码
npm run format:frontend  # 格式化前端代码
npm run format:backend   # 格式化后端代码
npm run test             # 运行测试
npm run test:frontend    # 运行前端测试
npm run test:backend     # 运行后端测试
```

#### 其他
```bash
npm run clean            # 清理依赖和构建文件
npm run install:all      # 安装所有依赖
npm run setup            # 一键设置项目环境
```

## 🎨 核心功能说明

### 1. 实时语音转录
- 基于FunASR开源模型，支持16kHz/16bit单声道音频
- WebSocket实时推送转录结果
- 支持文件上传转录和实时流式转录
- 自动说话人分段和标记

### 2. 智能声纹识别
- 使用3D-Speaker模型进行声纹注册和识别
- 支持快速声纹注册（30秒音频即可）
- 实时说话人识别，准确率95%+
- 说话人分离和聚类功能

### 3. AI纪要生成
- 集成DeepSeek V3大语言模型
- 三阶段生成流程：思考 → 搜索 → 生成
- 自动生成结构化会议纪要
- 支持多轮对话优化纪要内容

### 4. 自动化邮件
- 智能识别参会人员及邮箱
- 自动生成会议纪要邮件
- 支持邮件模板自定义
- 批量发送功能

### 5. 会议管理
- 会议列表和详情查看
- 会议录音上传和管理
- 转录记录实时更新
- 会议统计和分析

## 🔑 环境变量配置

### 后端环境变量 (backend/.env)

```bash
# 服务端口
PORT=5001

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/meeting-agent
REDIS_URL=redis://localhost:6379

# AI服务配置
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE=https://api.deepseek.com

# 阿里云配置（可选，用于OSS等）
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret

# FunASR服务配置
FUNASR_HTTP_URL=http://localhost:10095
FUNASR_WS_URL=ws://localhost:10096

# 3D-Speaker服务配置
SPEAKER_SERVICE_URL=http://localhost:5002

# 邮件配置（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# JWT配置
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_FILES=3d

# 文件上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=100MB
```

### 前端环境变量 (frontend/.env)

```bash
# API地址
VITE_API_BASE_URL=http://localhost:5001
VITE_WS_URL=ws://localhost:5001

# 应用配置
VITE_APP_TITLE=智能会议纪要Agent
VITE_APP_VERSION=1.0.0
```

## 🧪 测试说明

### 测试音频准备

将测试音频文件放置在以下目录：
```bash
backend/test-resources/audio/
```

音频格式要求：
- **格式**: WAV (推荐) / MP3 / M4A
- **采样率**: 16kHz
- **位深度**: 16bit
- **声道**: 单声道 (mono)

### 运行测试

```bash
# 后端测试
cd backend
npm test                 # 运行所有测试
npm run test:watch       # 监听模式
npm run test:coverage    # 生成覆盖率报告

# 前端测试
cd frontend
npm test                 # 运行所有测试

# Python服务测试
cd backend/python-services
source venv/bin/activate
python test_services.py  # 运行集成测试
```

## 📚 相关文档

- [快速启动指南](QUICK_START.md) - 详细的服务启动步骤
- [系统设计文档](docs/index.md) - 完整的系统规格说明
- [FunASR部署文档](docker/funasr/README.md) - FunASR服务部署指南
- [3D-Speaker服务文档](backend/python-services/README.md) - 声纹识别服务说明
- [Claude Code指令](CLAUDE.md) - 开发助手指令说明

## 🐛 常见问题

### Q1: FunASR容器启动失败

```bash
# 检查端口占用
lsof -i :10095
lsof -i :10096

# 如果端口被占用，停止占用进程
kill -9 <PID>

# 或修改端口配置
# 编辑 docker/docker-compose.funasr.yml
```

### Q2: 3D-Speaker服务安装失败

```bash
# 检查Python版本（需要3.8+）
python3 --version

# 升级pip
pip install --upgrade pip

# 手动安装torch（如果网络问题）
pip install torch==2.2.0 --index-url https://download.pytorch.org/whl/cpu
pip install torchaudio==2.2.0 --index-url https://download.pytorch.org/whl/cpu

# 然后安装其他依赖
pip install -r requirements.txt
```

### Q3: MongoDB连接失败

```bash
# 检查MongoDB服务状态
docker compose -f docker-compose.dev.yml ps

# 查看MongoDB日志
docker compose -f docker-compose.dev.yml logs mongodb

# 重启MongoDB
docker compose -f docker-compose.dev.yml restart mongodb
```

### Q4: 前端无法连接后端

```bash
# 检查后端服务是否运行
curl http://localhost:5001/health

# 检查端口是否被占用
lsof -i :5001
lsof -i :3000

# 检查环境变量配置
cat frontend/.env
cat backend/.env
```

### Q5: 音频转录失败

```bash
# 检查FunASR服务状态
curl http://localhost:10095/api/health

# 检查音频格式
ffmpeg -i your-audio.wav

# 转换音频格式（如需要）
ffmpeg -i input.mp3 -ar 16000 -ac 1 -sample_fmt s16 output.wav
```

## 🔍 性能优化建议

### CPU模式性能
- FunASR和3D-Speaker均运行在CPU模式
- 转录速度：约实时的1-2倍（取决于CPU性能）
- 声纹识别：单次识别约0.5-1秒
- 如需提升性能，可考虑：
  - 使用GPU模式（需要NVIDIA GPU）
  - 调整FunASR的CPU核心数（docker配置）
  - 使用更小的语音识别模型

### 日志管理
- 日志按日期轮转，默认保留3天
- 可修改`backend/.env`中的`LOG_MAX_FILES`调整保留天数
- 日志目录：`logs/`

### 数据库优化
- MongoDB建议配置索引（已在模型中定义）
- Redis用于会话缓存，减轻数据库压力
- 定期清理历史会议数据

## 🤝 开发指南

### 代码规范
- 使用ESLint + Prettier保持代码风格一致
- TypeScript严格模式，确保类型安全
- 提交前运行`npm run lint`和`npm run format`

### Git提交规范
```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 构建/工具链相关
```

### 分支管理
- `main`: 生产分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

### 贡献流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目Issues: [GitHub Issues](<repository-url>/issues)
- 邮箱: your-email@example.com

## 🙏 致谢

- [FunASR](https://github.com/alibaba-damo-academy/FunASR) - 语音识别模型
- [3D-Speaker](https://github.com/alibaba-damo-academy/3D-Speaker) - 声纹识别模型
- [DeepSeek](https://www.deepseek.com/) - AI大语言模型
- [Ant Design](https://ant.design/) - UI组件库

---

**版本**: v1.0.0
**最后更新**: 2025-10-27
**维护状态**: 活跃开发中
