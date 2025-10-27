# 声纹显示问题解决方案

## 🔍 问题分析

### 当前状态
```
✓ Node.js后端 (5001端口) - 运行正常
✓ 3D-Speaker服务 (5002端口) - 运行中，但API无响应
✓ 前端 (3000端口) - 运行正常
✗ FunASR (8000端口) - 未运行
```

### 问题根源

系统有两个后端服务：

1. **Node.js 后端 (端口5001)**
   - API路径: `/api/voiceprints/register`
   - 你刚才在这里注册了林彪的声纹 ✅

2. **Python 3D-Speaker 服务 (端口5002)**
   - API路径: `/api/speaker/list`
   - 前端从这里读取声纹列表 ❌
   - **问题**: 这个服务的API无响应

**结果**: 林彪的声纹保存在Node.js后端，但前端查询的是Python服务，所以看不到数据！

## 🛠️ 解决方案

### 方案A: 检查并修复3D-Speaker服务（推荐）

```bash
# 1. 检查Python服务日志
tail -50 /Users/xyli/Documents/Code/CodingWithHennessy/backend/python-services/logs/speaker.log

# 2. 重启3D-Speaker服务
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/python-services

# 查找并停止现有服务
ps aux | grep speaker_service.py
kill -9 <PID>

# 重新启动服务
python3 speaker_service.py &

# 3. 等待5-10秒后检查健康状态
sleep 10
curl http://localhost:5002/api/speaker/health
```

### 方案B: 在3D-Speaker服务中注册声纹

如果3D-Speaker服务正常运行，需要在那里注册声纹：

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/test-resources/audio/speaker_samples

# 注册到3D-Speaker服务（端口5002）
curl -X POST "http://localhost:5002/api/speaker/register" \
  -F "audioSamples=@林彪/segment_001.wav" \
  -F "audioSamples=@林彪/segment_002.wav" \
  -F "audioSamples=@林彪/segment_003.wav" \
  -F "name=林彪" \
  -F "department=测试部门" \
  -F "position=测试人员"
```

### 方案C: 统一后端服务

修改前端配置，让它连接到Node.js后端：

```typescript
// frontend/src/services/voiceprintService.ts
// 修改第6行：
const SPEAKER_API_BASE_URL = 'http://localhost:5001/api'  // 改为5001端口
```

但这需要确保Node.js后端的API路径与前端期望一致。

## 📊 快速诊断命令

### 检查所有服务状态
```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy
bash check_services.sh
```

### 检查各后端的声纹列表

```bash
# Node.js后端 (5001)
curl http://localhost:5001/api/voiceprints/list | python3 -m json.tool

# 3D-Speaker服务 (5002)
curl http://localhost:5002/api/speaker/list | python3 -m json.tool
```

### 检查Python服务进程
```bash
# 查看3D-Speaker进程
ps aux | grep speaker_service

# 查看FunASR进程
ps aux | grep funasr_service

# 查看进程输出
lsof -ti:5002
lsof -ti:8000
```

## 🚀 推荐操作步骤

### 步骤1: 诊断3D-Speaker服务

```bash
# 检查服务是否真的在运行
curl http://localhost:5002/api/speaker/health

# 如果返回错误，查看日志
tail -50 backend/python-services/logs/speaker.log

# 查看进程
ps aux | grep speaker_service.py
```

### 步骤2: 重启Python服务（如果需要）

```bash
cd backend/python-services

# 停止现有服务
pkill -f speaker_service.py

# 启动服务
python3 speaker_service.py > logs/speaker.log 2>&1 &

# 等待启动
sleep 10

# 验证
curl http://localhost:5002/api/speaker/health
```

### 步骤3: 重新注册声纹到正确的服务

一旦3D-Speaker服务正常，使用以下脚本注册：

```bash
cd /Users/xyli/Documents/Code/CodingWithHennessy/backend/test-resources/audio/speaker_samples

# 创建针对3D-Speaker的注册脚本
cat > register_to_3dspeaker.sh << 'EOF'
#!/bin/bash

API_BASE="http://localhost:5002/api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 注册林彪
echo "注册林彪..."
curl -X POST "$API_BASE/speaker/register" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_001.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_002.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_003.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_004.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_005.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_006.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_007.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_008.wav" \
  -F "audioSamples=@$SCRIPT_DIR/林彪/segment_012.wav" \
  -F "name=林彪" \
  -F "department=测试部门"

echo ""
echo "注册刘亚楼..."
curl -X POST "$API_BASE/speaker/register" \
  -F "audioSamples=@$SCRIPT_DIR/刘亚楼/segment_009.wav" \
  -F "audioSamples=@$SCRIPT_DIR/刘亚楼/segment_014.wav" \
  -F "audioSamples=@$SCRIPT_DIR/刘亚楼/segment_016.wav" \
  -F "name=刘亚楼" \
  -F "department=测试部门"

echo ""
echo "注册罗荣桓..."
curl -X POST "$API_BASE/speaker/register" \
  -F "audioSamples=@$SCRIPT_DIR/罗荣桓/segment_010.wav" \
  -F "audioSamples=@$SCRIPT_DIR/罗荣桓/segment_011.wav" \
  -F "audioSamples=@$SCRIPT_DIR/罗荣桓/segment_013.wav" \
  -F "name=罗荣桓" \
  -F "department=测试部门"

echo ""
echo "完成！"
EOF

chmod +x register_to_3dspeaker.sh
bash register_to_3dspeaker.sh
```

### 步骤4: 验证前端显示

```bash
# 在浏览器中刷新前端页面
# 访问: http://localhost:3000

# 或通过API验证
curl http://localhost:5002/api/speaker/list
```

## 🔧 长期解决方案

建议统一两个后端的数据：

1. **使用单一后端**: 让Node.js后端直接调用3D-Speaker Python服务
2. **数据同步**: 在Node.js后端注册声纹时，同步到3D-Speaker服务
3. **统一API**: 修改前端配置，使用统一的API端点

## 📝 当前注册状态

### Node.js 后端 (5001)
- ✅ 林彪 (9个样本) - 已注册
- ID: `68fb2fc6efab2e7f39f54581`

### 3D-Speaker 服务 (5002)
- ❓ 待确认 - 需要检查服务状态后注册

---

**更新时间**: 2025-10-24
**状态**: 等待3D-Speaker服务修复后重新注册
