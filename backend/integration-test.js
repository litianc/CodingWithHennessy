#!/usr/bin/env node
/**
 * 集成测试：声纹注册系统完整测试
 * 
 * 测试内容：
 * 1. 3D-Speaker API连接
 * 2. 声纹注册（带userId）
 * 3. 声纹注册（不带userId）
 * 4. MongoDB数据验证
 * 5. ownerId正确性验证
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

// 配置
const BACKEND_URL = 'http://localhost:5001';
const PYTHON_API_URL = 'http://localhost:5002';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-agent';
const TEST_AUDIO_DIR = './test-resources/audio';

// 测试用户ID
const DEMO_USER_ID = '507f1f77bcf86cd799439011'; // Demo模式用户
const VOICE_OWNER_ID = '507f191e810c19729de860ea'; // 声音所有者

// 测试结果
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 工具函数
function logTest(name, status, details) {
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${name}: ${status}`);
  if (details) {
    console.log(`   ${details}`);
  }
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  testResults.tests.push({ name, status, details });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试函数
async function test1_PythonAPIHealth() {
  console.log('\n📋 测试 1: 3D-Speaker Python API 健康检查');
  console.log('─'.repeat(80));
  
  try {
    const response = await axios.get(`${PYTHON_API_URL}/api/health`, { timeout: 5000 });
    
    if (response.status === 200 && response.data.status === 'ok') {
      logTest('Python API健康检查', 'PASS', `状态: ${response.data.status}`);
      return true;
    } else {
      logTest('Python API健康检查', 'FAIL', `意外响应: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    logTest('Python API健康检查', 'FAIL', `错误: ${error.message}`);
    return false;
  }
}

async function test2_BackendAPIHealth() {
  console.log('\n📋 测试 2: Node.js Backend API 健康检查');
  console.log('─'.repeat(80));
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      logTest('Backend API健康检查', 'PASS', '后端服务正常运行');
      return true;
    } else {
      logTest('Backend API健康检查', 'FAIL', `状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Backend API健康检查', 'FAIL', `错误: ${error.message}`);
    return false;
  }
}

async function test3_RegisterWithUserId() {
  console.log('\n📋 测试 3: 声纹注册（提供userId）');
  console.log('─'.repeat(80));
  console.log(`场景: 秘书为领导注册声纹`);
  console.log(`  - 当前用户（秘书）: ${DEMO_USER_ID}`);
  console.log(`  - 声音所有者（领导）: ${VOICE_OWNER_ID}`);
  
  const formData = new FormData();
  formData.append('name', '集成测试-领导A');
  formData.append('department', '行政部');
  formData.append('position', '部门领导');
  formData.append('userId', VOICE_OWNER_ID); // 关键：指定userId
  
  // 添加3个音频样本
  const audioFiles = [
    'liuyalou_segment_01_5.1s.wav',
    'liuyalou_segment_02_2.0s.wav',
    'liuyalou_segment_03_4.8s.wav'
  ];
  
  for (const audioFile of audioFiles) {
    const filePath = path.join(TEST_AUDIO_DIR, audioFile);
    if (!fs.existsSync(filePath)) {
      logTest('声纹注册（提供userId）', 'FAIL', `音频文件不存在: ${filePath}`);
      return null;
    }
    formData.append('audioSamples', fs.createReadStream(filePath));
  }
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/voiceprints/register`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );
    
    if (response.data.success) {
      const voiceprintId = response.data.data.id;
      logTest('声纹注册（提供userId）', 'PASS', `声纹ID: ${voiceprintId}`);
      console.log(`   ✓ 姓名: ${response.data.data.name}`);
      console.log(`   ✓ 样本数: ${response.data.data.samplesCount}`);
      return voiceprintId;
    } else {
      logTest('声纹注册（提供userId）', 'FAIL', `注册失败: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    logTest('声纹注册（提供userId）', 'FAIL', `错误: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   响应: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function test4_RegisterWithoutUserId() {
  console.log('\n📋 测试 4: 声纹注册（不提供userId）');
  console.log('─'.repeat(80));
  console.log(`场景: 用户注册自己的声纹`);
  console.log(`  - 当前用户: ${DEMO_USER_ID}`);
  console.log(`  - 期望ownerId: ${DEMO_USER_ID} (应回退到当前用户)`);
  
  const formData = new FormData();
  formData.append('name', '集成测试-用户B');
  formData.append('department', '技术部');
  formData.append('position', '工程师');
  // 不提供userId
  
  const audioFiles = [
    'liuyalou_segment_04_5.9s.wav',
    'liuyalou_segment_05_3.3s.wav',
    'liuyalou_segment_06_5.3s.wav'
  ];
  
  for (const audioFile of audioFiles) {
    const filePath = path.join(TEST_AUDIO_DIR, audioFile);
    if (!fs.existsSync(filePath)) {
      logTest('声纹注册（不提供userId）', 'FAIL', `音频文件不存在: ${filePath}`);
      return null;
    }
    formData.append('audioSamples', fs.createReadStream(filePath));
  }
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/voiceprints/register`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );
    
    if (response.data.success) {
      const voiceprintId = response.data.data.id;
      logTest('声纹注册（不提供userId）', 'PASS', `声纹ID: ${voiceprintId}`);
      console.log(`   ✓ 姓名: ${response.data.data.name}`);
      console.log(`   ✓ 样本数: ${response.data.data.samplesCount}`);
      return voiceprintId;
    } else {
      logTest('声纹注册（不提供userId）', 'FAIL', `注册失败: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    logTest('声纹注册（不提供userId）', 'FAIL', `错误: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   响应: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   完整错误: ${error.stack || error}`);
    }
    return null;
  }
}

async function test5_VerifyOwnerIdInDB(voiceprintId1, voiceprintId2) {
  console.log('\n📋 测试 5: 验证MongoDB中的ownerId');
  console.log('─'.repeat(80));
  
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    // 等待数据写入
    await sleep(2000);
    
    // 验证第一个声纹（应该使用提供的userId）
    if (voiceprintId1) {
      const vp1 = await db.collection('voiceprints').findOne({ _id: new mongoose.Types.ObjectId(voiceprintId1) });
      
      if (vp1) {
        const ownerId1 = vp1.ownerId.toString();
        if (ownerId1 === VOICE_OWNER_ID) {
          logTest('验证ownerId（提供userId）', 'PASS', `ownerId正确: ${ownerId1}`);
          console.log(`   ✓ 声纹: ${vp1.name}`);
          console.log(`   ✓ speakerId: ${vp1.speakerId}`);
          console.log(`   ✓ 样本数: ${vp1.sampleCount}`);
        } else {
          logTest('验证ownerId（提供userId）', 'FAIL', `期望: ${VOICE_OWNER_ID}, 实际: ${ownerId1}`);
        }
      } else {
        logTest('验证ownerId（提供userId）', 'FAIL', `在数据库中未找到声纹: ${voiceprintId1}`);
      }
    }
    
    // 验证第二个声纹（应该回退到当前用户ID）
    if (voiceprintId2) {
      const vp2 = await db.collection('voiceprints').findOne({ _id: new mongoose.Types.ObjectId(voiceprintId2) });
      
      if (vp2) {
        const ownerId2 = vp2.ownerId.toString();
        if (ownerId2 === DEMO_USER_ID) {
          logTest('验证ownerId（不提供userId）', 'PASS', `ownerId正确: ${ownerId2}`);
          console.log(`   ✓ 声纹: ${vp2.name}`);
          console.log(`   ✓ speakerId: ${vp2.speakerId}`);
          console.log(`   ✓ 样本数: ${vp2.sampleCount}`);
        } else {
          logTest('验证ownerId（不提供userId）', 'FAIL', `期望: ${DEMO_USER_ID}, 实际: ${ownerId2}`);
        }
      } else {
        logTest('验证ownerId（不提供userId）', 'FAIL', `在数据库中未找到声纹: ${voiceprintId2}`);
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    logTest('验证MongoDB ownerId', 'FAIL', `错误: ${error.message}`);
  }
}

async function test6_ListVoiceprints() {
  console.log('\n📋 测试 6: 列出声纹库');
  console.log('─'.repeat(80));
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/voiceprint/list`, { timeout: 5000 });
    
    if (response.data.success) {
      const count = response.data.data.total;
      logTest('列出声纹库', 'PASS', `共 ${count} 个声纹`);
      
      if (response.data.data.items.length > 0) {
        console.log(`\n   最近注册的声纹:`);
        response.data.data.items.slice(0, 5).forEach((vp, index) => {
          console.log(`   ${index + 1}. ${vp.name} (样本数: ${vp.samplesCount})`);
        });
      }
      return true;
    } else {
      logTest('列出声纹库', 'FAIL', `失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logTest('列出声纹库', 'FAIL', `错误: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   响应: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   完整错误: ${error.stack || error}`);
    }
    return false;
  }
}

// 主测试流程
async function runIntegrationTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 声纹注册系统 - 集成测试');
  console.log('='.repeat(80));
  console.log(`开始时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');
  
  // 测试1: Python API健康检查
  const pythonHealthOk = await test1_PythonAPIHealth();
  if (!pythonHealthOk) {
    console.log('\n❌ Python API不可用，中止测试');
    printSummary();
    process.exit(1);
  }
  
  // 测试2: Backend API健康检查
  const backendHealthOk = await test2_BackendAPIHealth();
  if (!backendHealthOk) {
    console.log('\n❌ Backend API不可用，中止测试');
    printSummary();
    process.exit(1);
  }
  
  // 测试3: 注册声纹（带userId）
  const voiceprintId1 = await test3_RegisterWithUserId();
  
  // 等待一下，避免并发问题
  await sleep(1000);
  
  // 测试4: 注册声纹（不带userId）
  const voiceprintId2 = await test4_RegisterWithoutUserId();
  
  // 测试5: 验证MongoDB中的ownerId
  await test5_VerifyOwnerIdInDB(voiceprintId1, voiceprintId2);
  
  // 测试6: 列出声纹库
  await test6_ListVoiceprints();
  
  // 打印测试总结
  printSummary();
  
  // 根据测试结果退出
  process.exit(testResults.failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试总结');
  console.log('='.repeat(80));
  console.log(`总测试数: ${testResults.total}`);
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log(`结束时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(80));
  
  if (testResults.failed > 0) {
    console.log('\n失败的测试:');
    testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ❌ ${t.name}: ${t.details}`);
    });
  }
}

// 运行测试
runIntegrationTests().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});
