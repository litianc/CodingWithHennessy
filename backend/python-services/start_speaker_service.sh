#!/bin/bash

# 3D-Speaker 服务启动脚本

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  启动 3D-Speaker 服务"
echo "========================================"
echo

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "✗ 虚拟环境不存在，请先运行安装脚本"
    exit 1
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 检查依赖
echo "检查 Python 依赖..."
python3 -c "import fastapi, uvicorn, torch" 2>/dev/null || {
    echo "✗ 缺少必要的依赖，请先运行: pip install -r requirements.txt"
    exit 1
}

echo "✓ 依赖检查通过"
echo

# 启动服务
echo "启动 3D-Speaker 服务..."
echo "  地址: http://0.0.0.0:5002"
echo "  健康检查: http://localhost:5002/api/health"
echo "  API 文档: http://localhost:5002/docs"
echo
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo

# 启动 uvicorn
uvicorn speaker_service.app:app \
    --host 0.0.0.0 \
    --port 5002 \
    --reload \
    --log-level info
