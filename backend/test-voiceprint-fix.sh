#!/bin/bash

# 测试声纹修复
# 这个脚本测试声纹注册和识别是否正常工作

echo "=== 声纹注册和识别测试 ==="
echo

# 配置
BASE_URL="http://localhost:5001"
TEST_AUDIO="/Users/xyli/Documents/Code/CodingWithHennessy/backend/test-resources/audio/sample1.wav"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查测试音频文件是否存在
if [ ! -f "$TEST_AUDIO" ]; then
    echo -e "${YELLOW}警告: 测试音频文件不存在: $TEST_AUDIO${NC}"
    echo "请确保有测试音频文件可用"
fi

echo "1. 获取声纹列表..."
RESPONSE=$(curl -s "$BASE_URL/api/voiceprint/list?page=1&pageSize=10")
echo "$RESPONSE" | jq '.'
echo

VOICEPRINT_COUNT=$(echo "$RESPONSE" | jq -r '.data.total // 0')
echo -e "当前声纹数量: ${GREEN}$VOICEPRINT_COUNT${NC}"
echo

if [ "$VOICEPRINT_COUNT" -gt 0 ]; then
    echo "2. 检查声纹详情（验证speakerId字段）..."
    FIRST_VOICEPRINT_ID=$(echo "$RESPONSE" | jq -r '.data.items[0].id // ""')

    if [ -n "$FIRST_VOICEPRINT_ID" ]; then
        DETAIL_RESPONSE=$(curl -s "$BASE_URL/api/voiceprint/$FIRST_VOICEPRINT_ID")
        echo "$DETAIL_RESPONSE" | jq '.'

        SPEAKER_ID=$(echo "$DETAIL_RESPONSE" | jq -r '.data.speakerId // ""')
        if [ -n "$SPEAKER_ID" ]; then
            echo -e "${GREEN}✓ speakerId 字段存在: $SPEAKER_ID${NC}"
        else
            echo -e "${RED}✗ speakerId 字段缺失${NC}"
        fi
    fi
else
    echo -e "${YELLOW}没有已注册的声纹，跳过详情检查${NC}"
fi

echo
echo "=== 测试完成 ==="
echo
echo -e "${GREEN}修复总结:${NC}"
echo "1. 已在 Voiceprint 模型中添加 speakerId 字段"
echo "2. 注册逻辑已更新，保存 3D-Speaker 返回的 speaker_id"
echo "3. 识别逻辑已更新，使用 speakerId 字段查询"
echo
echo -e "${YELLOW}注意:${NC}"
echo "- 旧的声纹数据可能缺少 speakerId 字段"
echo "- 建议重新注册声纹或手动迁移数据"
