# 智能会议纪要 Agent

基于AI技术的智能会议记录和分析系统，专为参加公司AI效率提升竞赛设计。

## 🎯 项目概述

### 核心功能
- **实时语音转录** - 阿里云语音识别 + 实时WebSocket推送
- **智能声纹识别** - 混合引擎架构（实时匹配 + 流式聚类）
- **AI纪要生成** - DeepSeek API智能分析生成结构化纪要
- **对话优化** - 多轮AI对话优化纪要内容
- **自动化邮件** - 智能识别参会者，自动发送会议纪要

### 技术亮点
- **双引擎声纹识别** - Demo模式快速注册 + 实时聚类学习
- **丝滑用户体验** - 零启动会议、实时视觉反馈、预测式交互
- **竞赛演示优化** - 震撼开场动画、魔法般技术展示、互动式体验

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    智能会议纪要Agent系统                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  React前端  │    │ Node.js后端 │    │  MongoDB    │          │
│  │  + TypeScript│    │ + Express   │    │  + Redis    │          │
│  │  + Socket.IO │    │ + Socket.IO │    │             │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                │                                │
│                                ▼                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ 阿里云语音  │    │ DeepSeek    │    │ 邮件服务    │          │
│  │ 识别API     │    │ AI模型      │    │ SMTP/IMAP   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 项目结构

```
meeting-agent/
├── frontend/                 # React前端项目
│   ├── src/
│   │   ├── components/       # UI组件
│   │   ├── hooks/           # 自定义Hooks
│   │   ├── services/        # API服务
│   │   ├── stores/          # 状态管理
│   │   └── utils/           # 工具函数
│   ├── public/
│   └── package.json
├── backend/                  # Node.js后端项目
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务服务
│   │   ├── models/          # 数据模型
│   │   ├── middleware/      # 中间件
│   │   ├── websocket/       # WebSocket处理
│   │   └── utils/           # 工具函数
│   └── package.json
├── docs/                     # 项目文档
│   ├── frontend-design.md   # 前端设计方案
│   ├── backend-design.md    # 后端设计方案
│   ├── api-design.md        # API接口设计
│   ├── database-design.md   # 数据库设计
│   └── deployment.md        # 部署配置
├── docker-compose.yml        # Docker编排文件
└── README.md                # 项目说明
```

## 🚀 快速开始

### 📋 环境要求
- Node.js 18+
- MongoDB 7.0+
- Redis 7.2+
- Docker (可选)

### 🎯 一键启动 (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd meeting-agent

# 2. 一键设置和安装
npm run setup

# 3. 启动数据库服务
npm run docker:dev

# 4. 启动开发服务器
npm run dev
```

### 🔧 手动安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd meeting-agent
```

2. **安装依赖**
```bash
# 安装所有依赖
npm run install:all
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 编辑环境变量文件，填入必要的API密钥：
# - DeepSeek API Key
# - 阿里云访问密钥
# - 邮件配置（可选）
```

4. **启动服务**

**方式一：使用 Docker (推荐)**
```bash
# 启动数据库服务
npm run docker:dev

# 启动应用
npm run dev
```

**方式二：本地服务**
```bash
# 确保本地已安装 MongoDB 和 Redis

# 启动后端服务
npm run dev:backend

# 启动前端服务 (新终端)
npm run dev:frontend
```

5. **访问应用**
- 前端地址: http://localhost:3000
- 后端API: http://localhost:5000
- 健康检查: http://localhost:5000/health

### 🐳 Docker 部署

**开发环境：**
```bash
npm run docker:dev    # 仅启动数据库服务
npm run docker:prod   # 启动完整服务
```

**生产环境：**
```bash
# 配置生产环境变量
cp .env.example .env

# 启动生产服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 📝 可用脚本

```bash
# 开发相关
npm run dev              # 同时启动前后端开发服务器
npm run dev:frontend     # 仅启动前端开发服务器
npm run dev:backend      # 仅启动后端开发服务器

# 构建相关
npm run build            # 构建前后端项目
npm run build:frontend   # 仅构建前端项目
npm run build:backend    # 仅构建后端项目

# Docker 相关
npm run docker:dev       # 启动开发环境数据库
npm run docker:prod      # 启动生产环境所有服务
npm run docker:stop      # 停止所有 Docker 服务
npm run docker:clean     # 清理 Docker 数据

# 代码质量
npm run lint             # 检查代码规范
npm run format           # 格式化代码
npm run test             # 运行测试

# 其他
npm run clean            # 清理依赖和构建文件
npm run install:all      # 安装所有依赖
```

## 🏆 竞赛演示特色

### 1. 混合声纹识别
- **快速注册**: 30秒声纹录入，立即可用
- **实时识别**: 95%+准确率，即时反馈
- **智能学习**: 边使用边优化，越用越准确

### 2. 沉浸式用户体验
- **震撼开场**: 3D粒子动画，个性化迎接
- **魔法转换**: 声波实时转为文字，视觉冲击力强
- **智能交互**: 预测用户需求，主动服务

### 3. AI智能分析
- **三阶段处理**: 深度思考 → 联网搜索 → 结构生成
- **对话优化**: 多轮对话，持续改进纪要质量
- **数据洞察**: 会议效率分析，团队协作报告

## 📖 技术文档

- [前端设计方案](docs/frontend-design.md)
- [后端设计方案](docs/backend-design.md)
- [API接口设计](docs/api-design.md)
- [数据库设计](docs/database-design.md)
- [部署配置指南](docs/deployment.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 邮箱: your-email@example.com
- 项目Issues: [GitHub Issues](link-to-issues)