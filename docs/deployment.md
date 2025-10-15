# 部署配置指南

## 🚀 快速部署

### 环境要求
- **Node.js 18+**
- **MongoDB 7.0+**
- **Redis 7.2+**
- **Docker & Docker Compose** (推荐)

### 一键启动
```bash
# 克隆项目
git clone <repository-url>
cd meeting-agent

# 使用Docker Compose启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:5000
```

## 🐳 Docker配置

### docker-compose.yml
```yaml
version: '3.8'

services:
  # MongoDB数据库
  mongodb:
    image: mongo:7.0
    container_name: meeting-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: meeting_agent
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
      - ./scripts/init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
    networks:
      - meeting-network

  # Redis缓存
  redis:
    image: redis:7.2-alpine
    container_name: meeting-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass redis123
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - meeting-network

  # 后端服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: meeting-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/meeting_agent?authSource=admin
      REDIS_URL: redis://:redis123@redis:6379
      JWT_SECRET: your-super-secret-jwt-key
      ALIBABA_CLOUD_ACCESS_KEY_ID: ${ALIBABA_CLOUD_ACCESS_KEY_ID}
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: ${ALIBABA_CLOUD_ACCESS_KEY_SECRET}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/logs:/app/logs
    networks:
      - meeting-network

  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        REACT_APP_API_URL: http://localhost:5000/api
        REACT_APP_SOCKET_URL: http://localhost:5000
    container_name: meeting-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - meeting-network

  # Nginx反向代理 (可选)
  nginx:
    image: nginx:alpine
    container_name: meeting-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - meeting-network

volumes:
  mongodb_data:
    driver: local
  redis_data:
    driver: local

networks:
  meeting-network:
    driver: bridge
```

## 🔧 环境配置

### 后端环境变量 (.env)
```bash
# 服务配置
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://admin:password123@localhost:27017/meeting_agent?authSource=admin
REDIS_URL=redis://:redis123@localhost:6379

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# 阿里云服务
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
ALIBABA_CLOUD_REGION=cn-hangzhou

# DeepSeek AI
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 邮件服务
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 文件上传
UPLOAD_MAX_SIZE=104857600  # 100MB
UPLOAD_ALLOWED_TYPES=audio/wav,audio/mp3,audio/webm,audio/ogg

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# CORS配置
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# 限流配置
RATE_LIMIT_WINDOW_MS=900000  # 15分钟
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket配置
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
```

### 前端环境变量 (.env)
```bash
# API配置
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000

# 应用配置
REACT_APP_NAME=智能会议纪要Agent
REACT_APP_VERSION=1.0.0

# 功能开关
REACT_APP_ENABLE_VOICEPRINT=true
REACT_APP_ENABLE_AI_CHAT=true
REACT_APP_ENABLE_EMAIL_SEND=true

# 音频配置
REACT_APP_AUDIO_SAMPLE_RATE=16000
REACT_APP_AUDIO_CHANNELS=1
REACT_APP_AUDIO_CHUNK_SIZE=4096

# UI配置
REACT_APP_THEME=light
REACT_APP_LANGUAGE=zh-CN
```

## 📦 构建配置

### 后端Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 构建应用
RUN npm run build

# 生产镜像
FROM node:18-alpine AS production

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# 创建必要目录
RUN mkdir -p uploads logs && chown -R nodejs:nodejs uploads logs

USER nodejs

EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js

CMD ["node", "dist/app.js"]
```

### 前端Dockerfile
```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

RUN npm run build

# 生产阶段
FROM nginx:alpine AS production

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

## 🌐 Nginx配置

### nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:5000;
    }

    upstream frontend {
        server frontend:80;
    }

    # 限制请求大小 (文件上传)
    client_max_body_size 100M;

    # Gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    server {
        listen 80;
        server_name localhost;

        # 前端静态文件
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API接口
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket支持
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # WebSocket连接
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 📈 监控配置

### 健康检查端点
```javascript
// 后端健康检查
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      externalServices: await checkExternalServices()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Docker监控脚本
```bash
#!/bin/bash
# monitor.sh - 服务监控脚本

echo "=== 容器状态 ==="
docker-compose ps

echo -e "\n=== 资源使用情况 ==="
docker stats --no-stream

echo -e "\n=== 最近日志 (后端) ==="
docker-compose logs --tail=50 backend

echo -e "\n=== 最近日志 (前端) ==="
docker-compose logs --tail=20 frontend
```

## 🔒 安全配置

### 生产环境安全检查清单
- [ ] 更改默认密码
- [ ] 使用HTTPS (SSL证书)
- [ ] 配置防火墙规则
- [ ] 启用访问日志
- [ ] 定期备份数据
- [ ] 监控异常访问
- [ ] 更新依赖包
- [ ] 配置CSP头部

### SSL证书配置
```bash
# 使用Let's Encrypt获取免费SSL证书
certbot certonly --webroot -w /var/www/html -d yourdomain.com

# 自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 🔄 CI/CD配置

### GitHub Actions工作流
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && npm ci
      - name: Run tests
        run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.PRIVATE_KEY }}
          script: |
            cd /path/to/meeting-agent
            git pull origin main
            docker-compose down
            docker-compose up -d --build
```

## 🚨 故障排除

### 常见问题及解决方案

#### 1. 容器启动失败
```bash
# 查看详细错误日志
docker-compose logs service-name

# 检查端口占用
netstat -tulpn | grep :port

# 清理Docker资源
docker system prune -a
```

#### 2. 数据库连接问题
```bash
# 检查MongoDB连接
docker exec -it meeting-mongodb mongo --eval "db.adminCommand('ismaster')"

# 检查Redis连接
docker exec -it meeting-redis redis-cli ping
```

#### 3. 前端无法访问后端
```bash
# 检查网络连接
docker network ls
docker network inspect meeting-agent_meeting-network

# 检查服务发现
docker exec meeting-backend ping mongodb
docker exec meeting-frontend ping backend
```

## 📋 部署检查清单

### 部署前检查
- [ ] 环境变量配置完整
- [ ] SSL证书配置
- [ ] 数据库备份
- [ ] 依赖包安全扫描
- [ ] 性能基准测试

### 部署后验证
- [ ] 所有服务正常运行
- [ ] 健康检查通过
- [ ] 核心功能测试
- [ ] 监控指标正常
- [ ] 日志收集正常

这个部署配置确保了系统能够快速、安全、稳定地部署到生产环境。