#!/bin/bash

# 智能会议纪要 Agent 演示启动脚本
# 该脚本会启动后端和前端服务

echo "======================================"
echo "  智能会议纪要 Agent - Demo 启动"
echo "======================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 MongoDB
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB 未运行"
    echo "正在尝试启动 MongoDB..."
    if command -v brew &> /dev/null; then
        brew services start mongodb-community
        sleep 3
    else
        echo "❌ 请手动启动 MongoDB"
        exit 1
    fi
fi

echo "✅ MongoDB 运行中"
echo ""

# 启动后端
echo "📦 启动后端服务..."
cd backend

if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
fi

# 启动后端（后台运行）
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID) - 端口: 5001"
echo "   日志文件: backend.log"
cd ..

# 等待后端启动
echo "等待后端服务就绪..."
sleep 5

# 启动前端
echo ""
echo "🎨 启动前端服务..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi

# 启动前端（后台运行）
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID) - 端口: 3000"
echo "   日志文件: frontend.log"
cd ..

echo ""
echo "======================================"
echo "  🎉 演示环境启动完成！"
echo "======================================"
echo ""
echo "📝 服务信息："
echo "   • 后端 API: http://localhost:5001"
echo "   • 前端界面: http://localhost:3000"
echo "   • WebSocket: ws://localhost:5001"
echo ""
echo "🚀 快速开始："
echo "   1. 打开浏览器访问: http://localhost:3000"
echo "   2. 创建或加入会议"
echo "   3. 点击 '开始会议' 进入会议"
echo "   4. 点击 '🎤 开始录音' 录制会议音频"
echo "   5. 或点击 '📁 上传音频文件' 上传已有录音"
echo "   6. 停止后点击 '生成会议纪要' 体验AI自动生成"
echo ""
echo "📊 实时监控："
echo "   • 查看后端日志: tail -f backend.log"
echo "   • 查看前端日志: tail -f frontend.log"
echo ""
echo "⏹️  停止服务:"
echo "   执行: ./stop-demo.sh"
echo "   或按 Ctrl+C 后执行: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "💡 提示: 首次启动可能需要更多时间..."
echo ""

# 保存PID到文件
echo "$BACKEND_PID" > .demo-backend.pid
echo "$FRONTEND_PID" > .demo-frontend.pid

# 等待用户中断
echo "按 Ctrl+C 停止所有服务..."
wait
