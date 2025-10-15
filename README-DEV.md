# 智能会议纪要 Agent - 开发环境启动指南

## 快速启动

### 1. 启动后端服务器

```bash
cd backend
npx ts-node src/index-simple.ts
```

后端将在 http://localhost:5001 启动

### 2. 启动前端服务器

```bash
cd frontend
npm run dev
```

前端将在 http://localhost:3001 启动

## 已完成的功能

### 用户界面 (UI)
- ✅ 用户登录注册页面 - 支持邮箱/用户名登录，表单验证，动画效果
- ✅ 会议列表页面 - 会议搜索、过滤、创建、删除功能
- ✅ 会议详情页面 - 会议控制面板、多标签页界面（实时转录、会议纪要、AI助手）
- ✅ 会议纪要页面 - AI生成纪要、编辑、导出功能
- ✅ 实时转录组件 - 支持说话人识别、置信度显示、编辑功能
- ✅ AI聊天助手 - 快捷建议、消息历史、反馈功能
- ✅ 参与者管理 - 添加/删除参与者、角色管理

### 系统架构
- ✅ 前端：React + TypeScript + Vite + Ant Design + Tailwind CSS
- ✅ 状态管理：Zustand
- ✅ 后端：Node.js + Express + TypeScript + Socket.IO
- ✅ 实时通信：WebSocket
- ✅ 错误处理：全局错误边界和通知系统
- ✅ API拦截器：请求/响应拦截，token管理

### 开发工具
- ✅ 开发环境配置（.env文件）
- ✅ 简化的后端服务器（index-simple.ts）
- ✅ 跨域配置
- ✅ 热重载支持

## 测试环境状态

- 🟢 后端服务器：运行中 (http://localhost:5001)
- 🟢 前端服务器：运行中 (http://localhost:3001)
- 🟢 API连接：正常
- 🟢 WebSocket：就绪

## API端点

- `GET /health` - 健康检查
- `GET /api/test` - API测试

## 下一步开发

1. 完善用户认证API
2. 集成会议管理功能
3. 添加音频录制和转录
4. 集成AI服务（DeepSeek）
5. 添加邮件发送功能
6. 完善数据库集成

## 注意事项

- 当前使用简化的后端服务器，包含基础的Express和Socket.IO功能
- 生产环境需要使用完整的backend/src/index.ts
- 确保MongoDB和Redis服务已启动（如果使用完整后端）
- 所有敏感信息已使用开发环境的模拟值