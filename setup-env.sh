#!/bin/bash

echo "🚀 智能会议纪要 Agent - 环境配置助手"
echo "=========================================="

# 检查是否存在 .env 文件
if [ ! -f ".env" ]; then
    echo "📋 创建根目录 .env 文件..."
    cp .env.example .env
fi

if [ ! -f "backend/.env" ]; then
    echo "📋 创建 backend/.env 文件..."
    cp backend/.env.example backend/.env
fi

echo ""
echo "📝 需要手动配置以下环境变量："
echo ""
echo "1. DeepSeek API Key:"
echo "   - 访问: https://platform.deepseek.com/"
echo "   - 获取 API Key 并填入 DEEPSEEK_API_KEY"
echo ""
echo "2. 阿里云服务配置:"
echo "   - 访问: https://ecs.console.aliyun.com/"
echo "   - 获取 AccessKey ID 和 Secret"
echo "   - 访问: https://nls-portal.console.aliyun.com/"
echo "   - 获取语音识别 AppKey"
echo ""
echo "3. 邮件配置 (可选):"
echo "   - Gmail 用户: 设置 SMTP_USER 和 SMTP_PASS"
echo "   - 应用专用密码: https://myaccount.google.com/apppasswords"
echo ""
echo "🔧 配置完成后运行:"
echo "   npm install  # 安装依赖"
echo "   npm run dev   # 启动开发服务器"
echo ""
echo "📚 更多配置信息请查看 README.md"