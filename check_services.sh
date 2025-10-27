#!/bin/bash

# 服务状态监控脚本
# 监控前端、后端、FunASR、3D-Speaker的运行状态

echo "=========================================="
echo "🔍 服务状态监控"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务函数
check_service() {
    local service_name=$1
    local port=$2
    local url=$3

    echo -n "[$service_name] "

    # 检查端口
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -ne "${GREEN}✓${NC} 端口 $port 正在运行"

        # 检查HTTP响应
        if [ -n "$url" ]; then
            if curl -s -f "$url" > /dev/null 2>&1; then
                echo -e " | ${GREEN}✓${NC} API可访问"
            else
                echo -e " | ${YELLOW}⚠${NC} API无响应"
            fi
        else
            echo ""
        fi
    else
        echo -e "${RED}✗${NC} 端口 $port 未运行"
    fi
}

# 1. 前端服务（React）
echo "1️⃣  前端服务 (React)"
check_service "Frontend" 3000 "http://localhost:3000"
echo ""

# 2. Node.js 后端
echo "2️⃣  Node.js 后端"
check_service "Node.js Backend" 5001 "http://localhost:5001/health"
echo ""

# 3. Python 3D-Speaker 服务
echo "3️⃣  3D-Speaker 服务 (Python)"
check_service "3D-Speaker" 5002 "http://localhost:5002/api/speaker/health"
echo ""

# 4. FunASR 服务
echo "4️⃣  FunASR 服务 (Python)"
check_service "FunASR" 8000 "http://localhost:8000/health"
echo ""

# 5. MongoDB
echo "5️⃣  数据库服务"
echo -n "[MongoDB] "
if pgrep -x mongod > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 正在运行"
else
    echo -e "${YELLOW}⚠${NC} 未运行或未安装"
fi

# 6. Redis
echo -n "[Redis] "
if pgrep -x redis-server > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 正在运行"
else
    echo -e "${YELLOW}⚠${NC} 未运行或未安装"
fi

echo ""
echo "=========================================="
echo "📊 服务汇总"
echo "=========================================="
echo ""

# 统计运行中的服务
running=0
total=6

for port in 3000 5001 5002 8000; do
    if lsof -ti:$port > /dev/null 2>&1; then
        ((running++))
    fi
done

if pgrep -x mongod > /dev/null 2>&1; then
    ((running++))
fi

if pgrep -x redis-server > /dev/null 2>&1; then
    ((running++))
fi

echo "运行中: $running/$total"
echo ""

# 给出建议
if [ $running -eq $total ]; then
    echo -e "${GREEN}✅ 所有服务正常运行${NC}"
elif [ $running -eq 0 ]; then
    echo -e "${RED}❌ 所有服务都未运行${NC}"
    echo ""
    echo "💡 启动建议:"
    echo "   1. 启动数据库: brew services start mongodb-community"
    echo "   2. 启动Redis: brew services start redis"
    echo "   3. 启动后端: cd backend && npm run dev"
    echo "   4. 启动前端: cd frontend && npm run dev"
    echo "   5. 启动3D-Speaker: cd backend/python-services && python3 speaker_service.py"
    echo "   6. 启动FunASR: cd backend/python-services && python3 funasr_service.py"
else
    echo -e "${YELLOW}⚠️  部分服务未运行${NC}"
    echo ""
    echo "💡 未运行的服务:"

    if ! lsof -ti:3000 > /dev/null 2>&1; then
        echo "   - 前端 (端口3000): cd frontend && npm run dev"
    fi

    if ! lsof -ti:5001 > /dev/null 2>&1; then
        echo "   - Node.js后端 (端口5001): cd backend && npm run dev"
    fi

    if ! lsof -ti:5002 > /dev/null 2>&1; then
        echo "   - 3D-Speaker (端口5002): cd backend/python-services && python3 speaker_service.py"
    fi

    if ! lsof -ti:8000 > /dev/null 2>&1; then
        echo "   - FunASR (端口8000): cd backend/python-services && python3 funasr_service.py"
    fi

    if ! pgrep -x mongod > /dev/null 2>&1; then
        echo "   - MongoDB: brew services start mongodb-community"
    fi

    if ! pgrep -x redis-server > /dev/null 2>&1; then
        echo "   - Redis: brew services start redis"
    fi
fi

echo ""

# 详细信息选项
echo "=========================================="
echo "📝 详细信息"
echo "=========================================="
echo ""
echo "查看详细日志:"
echo "  - 前端: tail -f frontend/logs/frontend.log"
echo "  - 后端: tail -f backend/logs/backend.log"
echo "  - 3D-Speaker: tail -f backend/python-services/logs/speaker.log"
echo "  - FunASR: tail -f backend/python-services/logs/funasr.log"
echo ""
echo "重新运行此脚本: bash check_services.sh"
echo ""
