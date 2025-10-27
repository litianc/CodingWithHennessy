#!/usr/bin/env python3
"""
服务测试脚本

测试 FunASR 和 3D-Speaker 服务的基本功能
"""

import requests
import sys
import os
from pathlib import Path

# 服务配置
FUNASR_URL = os.getenv('FUNASR_SERVICE_URL', 'http://localhost:10095')
SPEAKER_URL = os.getenv('SPEAKER_SERVICE_URL', 'http://localhost:5002')

# 测试音频文件
TEST_AUDIO_DIR = Path(__file__).parent.parent / 'test-resources' / 'audio'
TEST_AUDIO_FILE = TEST_AUDIO_DIR / 'meeting-test-16k.wav'

def print_section(title):
    """打印分节标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_funasr_health():
    """测试 FunASR 健康检查"""
    print_section("测试 FunASR 健康检查")

    try:
        response = requests.get(f'{FUNASR_URL}/api/health', timeout=5)
        if response.status_code == 200:
            print(f"✓ FunASR 服务运行正常")
            print(f"  响应: {response.json()}")
            return True
        else:
            print(f"✗ FunASR 服务响应异常: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ FunASR 服务连接失败: {e}")
        return False

def test_speaker_health():
    """测试 3D-Speaker 健康检查"""
    print_section("测试 3D-Speaker 健康检查")

    try:
        response = requests.get(f'{SPEAKER_URL}/api/health', timeout=5)
        if response.status_code == 200:
            print(f"✓ 3D-Speaker 服务运行正常")
            print(f"  响应: {response.json()}")
            return True
        else:
            print(f"✗ 3D-Speaker 服务响应异常: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 3D-Speaker 服务连接失败: {e}")
        return False

def test_funasr_transcribe():
    """测试 FunASR 语音识别"""
    print_section("测试 FunASR 语音识别")

    if not TEST_AUDIO_FILE.exists():
        print(f"✗ 测试音频文件不存在: {TEST_AUDIO_FILE}")
        return False

    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'audio': ('test.wav', f, 'audio/wav')}
            data = {'language': 'zh'}

            print(f"  发送音频文件: {TEST_AUDIO_FILE.name}")
            response = requests.post(
                f'{FUNASR_URL}/api/recognize',
                files=files,
                data=data,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                print(f"✓ 语音识别成功")
                if result.get('data') and result['data'].get('text'):
                    print(f"  识别结果: {result['data']['text'][:100]}...")
                else:
                    print(f"  响应: {result}")
                return True
            else:
                print(f"✗ 语音识别失败: {response.status_code}")
                print(f"  响应: {response.text}")
                return False
    except Exception as e:
        print(f"✗ 语音识别请求失败: {e}")
        return False

def test_speaker_register():
    """测试 3D-Speaker 声纹注册"""
    print_section("测试 3D-Speaker 声纹注册")

    if not TEST_AUDIO_FILE.exists():
        print(f"✗ 测试音频文件不存在: {TEST_AUDIO_FILE}")
        return False, None

    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'audio': ('test.wav', f, 'audio/wav')}
            data = {
                'name': '测试用户',
                'user_id': 'test_user_001',
                'email': 'test@example.com'
            }

            print(f"  注册声纹: 测试用户 (test_user_001)")
            response = requests.post(
                f'{SPEAKER_URL}/api/speaker/register',
                files=files,
                data=data,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    speaker_id = result['data']['speaker_id']
                    print(f"✓ 声纹注册成功")
                    print(f"  Speaker ID: {speaker_id}")
                    return True, speaker_id
                else:
                    print(f"✗ 声纹注册失败: {result.get('message')}")
                    return False, None
            else:
                print(f"✗ 声纹注册失败: {response.status_code}")
                print(f"  响应: {response.text}")
                return False, None
    except Exception as e:
        print(f"✗ 声纹注册请求失败: {e}")
        return False, None

def test_speaker_recognize():
    """测试 3D-Speaker 说话人识别"""
    print_section("测试 3D-Speaker 说话人识别")

    if not TEST_AUDIO_FILE.exists():
        print(f"✗ 测试音频文件不存在: {TEST_AUDIO_FILE}")
        return False

    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'audio': ('test.wav', f, 'audio/wav')}
            data = {'top_k': 5}

            print(f"  识别说话人...")
            response = requests.post(
                f'{SPEAKER_URL}/api/speaker/recognize',
                files=files,
                data=data,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    matches = result['data'].get('matches', [])
                    print(f"✓ 说话人识别成功")
                    print(f"  找到 {len(matches)} 个匹配")
                    for i, match in enumerate(matches[:3], 1):
                        print(f"    {i}. {match['name']} - 相似度: {match['similarity']:.2%}")
                    return True
                else:
                    print(f"✗ 说话人识别失败: {result.get('message')}")
                    return False
            else:
                print(f"✗ 说话人识别失败: {response.status_code}")
                print(f"  响应: {response.text}")
                return False
    except Exception as e:
        print(f"✗ 说话人识别请求失败: {e}")
        return False

def test_speaker_list():
    """测试获取说话人列表"""
    print_section("测试获取说话人列表")

    try:
        response = requests.get(f'{SPEAKER_URL}/api/speaker/list', timeout=10)

        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                speakers = result['data'].get('speakers', [])
                print(f"✓ 获取说话人列表成功")
                print(f"  共有 {len(speakers)} 个已注册说话人")
                for speaker in speakers[:5]:
                    print(f"    - {speaker['name']} ({speaker['speaker_id']})")
                return True
            else:
                print(f"✗ 获取说话人列表失败: {result.get('message')}")
                return False
        else:
            print(f"✗ 获取说话人列表失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 获取说话人列表请求失败: {e}")
        return False

def test_speaker_delete(speaker_id):
    """测试删除说话人"""
    print_section("测试删除说话人")

    if not speaker_id:
        print(f"  跳过删除测试（无有效 speaker_id）")
        return True

    try:
        response = requests.delete(
            f'{SPEAKER_URL}/api/speaker/{speaker_id}',
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✓ 删除说话人成功: {speaker_id}")
                return True
            else:
                print(f"✗ 删除说话人失败: {result.get('message')}")
                return False
        else:
            print(f"✗ 删除说话人失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 删除说话人请求失败: {e}")
        return False

def main():
    """主测试流程"""
    print_section("服务集成测试")
    print(f"FunASR URL: {FUNASR_URL}")
    print(f"Speaker URL: {SPEAKER_URL}")
    print(f"测试音频: {TEST_AUDIO_FILE}")

    results = {}

    # 1. 健康检查
    results['funasr_health'] = test_funasr_health()
    results['speaker_health'] = test_speaker_health()

    # 如果健康检查失败，提前退出
    if not results['funasr_health'] or not results['speaker_health']:
        print_section("测试结果汇总")
        print("✗ 服务健康检查失败，请确保服务正在运行")
        print("\n启动服务的命令:")
        print("  FunASR:    cd docker && docker compose -f docker-compose.funasr.yml up -d")
        print("  3D-Speaker: cd backend/python-services && source venv/bin/activate && uvicorn speaker_service.app:app --host 0.0.0.0 --port 5002")
        return 1

    # 2. FunASR 语音识别测试
    results['funasr_transcribe'] = test_funasr_transcribe()

    # 3. 3D-Speaker 测试流程
    results['speaker_register'], speaker_id = test_speaker_register()
    results['speaker_recognize'] = test_speaker_recognize()
    results['speaker_list'] = test_speaker_list()
    results['speaker_delete'] = test_speaker_delete(speaker_id)

    # 汇总结果
    print_section("测试结果汇总")
    total = len(results)
    passed = sum(1 for r in results.values() if r)
    failed = total - passed

    print(f"总计: {total} 项测试")
    print(f"通过: {passed} 项 ✓")
    print(f"失败: {failed} 项 ✗")
    print()

    for test_name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {test_name:25s} {status}")

    print()

    if failed == 0:
        print("🎉 所有测试通过！")
        return 0
    else:
        print(f"⚠️  {failed} 项测试失败")
        return 1

if __name__ == '__main__':
    sys.exit(main())
