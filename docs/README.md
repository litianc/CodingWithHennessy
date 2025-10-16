# 智能会议纪要 Agent - 文档中心

## 📚 文档导航

### 项目概览
- [主项目说明](../README.md) - 项目介绍和快速开始
- [项目状态](./PROJECT_STATUS.md) - 当前开发状态和进度
- [开发任务清单](./TODO.md) - 后端开发任务和技术债务

### 设计文档
- [系统需求文档](./index.md) - 完整的系统规格说明
- [后端设计](./backend-design.md) - 后端架构和实现细节
- [前端设计](./frontend-design.md) - 前端UI和交互设计
- [数据库设计](./database-design.md) - 数据模型和Schema设计
- [API设计](./api-design.md) - RESTful API接口规范

### 开发指南
- [开发指南](./development.md) - 本地开发环境配置和开发流程
- [部署文档](./deployment.md) - 生产环境部署指南

### 测试报告
- [集成测试报告](./INTEGRATION_TEST_REPORT_2025-10-15_16-30-00.md) - 最新的集成测试结果

## 🏗️ 系统架构

本系统采用前后端分离架构：

- **前端**: React + TypeScript + Ant Design + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **数据库**: MongoDB + Redis
- **AI服务**: DeepSeek V3.2 LLM
- **语音服务**: 阿里云语音识别 + 声纹识别

## 🚀 核心功能

1. **实时会议转录** - Whisper/阿里云语音识别
2. **智能声纹识别** - 自动识别参会人员
3. **AI纪要生成** - DeepSeek驱动的智能摘要
4. **AI交互优化** - 对话式纪要优化
5. **自动邮件发送** - 参会人员邮件通知

## 📖 如何使用本文档

1. **新手入门**: 从 [主项目说明](../README.md) 和 [开发指南](./development.md) 开始
2. **系统了解**: 阅读 [系统需求文档](./index.md) 了解完整功能
3. **开发参考**: 查阅各设计文档了解实现细节
4. **API集成**: 参考 [API设计](./api-design.md) 进行接口调用

## 🔄 文档更新

文档会随着项目开发持续更新，最新版本请查看Git历史记录。

---

**更新时间**: 2025-10-16
**项目状态**: 后端核心功能开发中，前端UI基础框架完成
