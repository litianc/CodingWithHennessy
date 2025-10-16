#!/bin/bash

# 智能会议纪要 Agent 演示停止脚本

echo "======================================"
echo "  停止演示服务"
echo "======================================"
echo ""

# 读取保存的PID
if [ -f ".demo-backend.pid" ]; then
    BACKEND_PID=$(cat .demo-backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "⏹️  停止后端服务 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        echo "✅ 后端服务已停止"
    fi
    rm .demo-backend.pid
fi

if [ -f ".demo-frontend.pid" ]; then
    FRONTEND_PID=$(cat .demo-frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "⏹️  停止前端服务 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo "✅ 前端服务已停止"
    fi
    rm .demo-frontend.pid
fi

echo ""
echo "🧹 清理日志文件..."
rm -f backend.log frontend.log

echo ""
echo "✅ 演示服务已全部停止"
echo ""
