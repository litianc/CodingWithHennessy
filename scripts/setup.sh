#!/bin/bash

# 智能会议纪要 Agent 项目安装脚本

set -e

echo "🚀 开始设置智能会议纪要 Agent 项目..."

# 检查必要的工具
check_requirements() {
    echo "📋 检查系统要求..."

    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js 18+ 版本"
        exit 1
    fi

    echo "✅ 系统要求检查完成"
}

# 安装前端依赖
install_frontend() {
    echo "📦 安装前端依赖..."
    cd frontend
    npm install
    cd ..
    echo "✅ 前端依赖安装完成"
}

# 安装后端依赖
install_backend() {
    echo "📦 安装后端依赖..."
    cd backend
    npm install
    cd ..
    echo "✅ 后端依赖安装完成"
}

# 创建环境变量文件
setup_env() {
    echo "⚙️  设置环境变量..."

    if [ ! -f .env ]; then
        cp .env.example .env
        echo "✅ 已创建根目录 .env 文件"
    fi

    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        echo "✅ 已创建前端 .env 文件"
    fi

    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo "✅ 已创建后端 .env 文件"
    fi

    echo "⚠️  请编辑环境变量文件，填入必要的 API 密钥和配置信息"
}

# 创建必要的目录
create_directories() {
    echo "📁 创建必要的目录..."

    mkdir -p backend/uploads
    mkdir -p backend/logs
    mkdir -p docker/nginx

    echo "✅ 目录创建完成"
}

# 显示下一步操作
show_next_steps() {
    echo ""
    echo "🎉 项目设置完成！"
    echo ""
    echo "📋 下一步操作："
    echo "1. 编辑环境变量文件，填入必要的 API 密钥"
    echo "2. 启动数据库服务："
    echo "   docker-compose -f docker-compose.dev.yml up -d"
    echo "3. 启动开发服务器："
    echo "   npm run dev"
    echo ""
    echo "📖 更多信息请查看 README.md"
}

# 主函数
main() {
    check_requirements
    create_directories
    setup_env
    install_frontend
    install_backend
    show_next_steps
}

# 运行主函数
main "$@"