#!/bin/bash
# 3D-Speaker 服务环境安装脚本

set -e

echo "==================================="
echo "3D-Speaker 服务环境安装"
echo "==================================="

# 检查 Python 版本
echo -e "\n>>> 检查 Python 版本..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python 版本: $python_version"

# 推荐 Python 3.8-3.10
required_version="3.8"
if [[ $(echo "$python_version $required_version" | awk '{print ($1 >= $2)}') == 1 ]]; then
    echo "✓ Python 版本满足要求 (>= $required_version)"
else
    echo "✗ Python 版本过低，推荐使用 Python 3.8 或更高版本"
    exit 1
fi

# 创建虚拟环境
echo -e "\n>>> 创建虚拟环境..."
if [ -d "venv" ]; then
    echo "虚拟环境已存在，跳过创建"
else
    python3 -m venv venv
    echo "✓ 虚拟环境创建成功"
fi

# 激活虚拟环境
echo -e "\n>>> 激活虚拟环境..."
source venv/bin/activate
echo "✓ 虚拟环境已激活"

# 升级 pip
echo -e "\n>>> 升级 pip..."
pip install --upgrade pip

# 安装依赖
echo -e "\n>>> 安装依赖包..."
pip install -r requirements.txt

echo -e "\n>>> 检查 PyTorch 安装..."
python -c "import torch; print(f'PyTorch 版本: {torch.__version__}')"

# 创建必要的目录
echo -e "\n>>> 创建必要的目录..."
mkdir -p models
mkdir -p voiceprints
mkdir -p logs
echo "✓ 目录创建完成"

# 创建 .env 文件（如果不存在）
if [ ! -f ".env" ]; then
    echo -e "\n>>> 创建 .env 配置文件..."
    cat > .env << EOF
# 3D-Speaker 服务配置
SPEAKER_HOST=0.0.0.0
SPEAKER_PORT=5002
SPEAKER_WORKERS=1
SPEAKER_DEBUG=False

# 模型配置
SPEAKER_MODEL_DIR=./models
SPEAKER_SPEAKER_MODEL=damo/speech_eres2net_base_200k_sv_zh-cn_16k-common
SPEAKER_DEVICE=cpu

# 声纹存储
SPEAKER_VOICEPRINT_DIR=./voiceprints

# 音频处理
SPEAKER_SAMPLE_RATE=16000
SPEAKER_MIN_AUDIO_LENGTH=0.5
SPEAKER_MAX_AUDIO_LENGTH=30.0

# 识别参数
SPEAKER_SIMILARITY_THRESHOLD=0.75
SPEAKER_TOP_K_MATCHES=5

# 日志配置
SPEAKER_LOG_LEVEL=INFO
SPEAKER_LOG_FILE=./logs/speaker_service.log

# CORS 配置
SPEAKER_CORS_ORIGINS=["http://localhost:3000", "http://localhost:5001"]
EOF
    echo "✓ .env 文件创建成功"
    echo "请根据需要修改 .env 中的配置"
fi

echo -e "\n==================================="
echo "安装完成！"
echo "==================================="
echo -e "\n使用方法:"
echo "1. 激活虚拟环境: source venv/bin/activate"
echo "2. 启动服务: python -m speaker_service.app"
echo "或使用 uvicorn: uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002"
echo ""
echo "服务将在 http://localhost:5002 启动"
echo "API 文档: http://localhost:5002/docs"
echo "==================================="
