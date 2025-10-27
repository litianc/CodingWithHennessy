/**
 * 声纹数据迁移脚本
 *
 * 为旧的声纹数据添加 speakerId 字段
 *
 * 使用方法：
 * npx ts-node scripts/migrate-voiceprint-speakerId.ts
 */

import mongoose from 'mongoose'
import { Voiceprint } from '../src/models/Voiceprint'
import { logger } from '../src/utils/logger'
import crypto from 'crypto'

// 生成 speakerId (与 3D-Speaker 服务的生成逻辑一致)
function generateSpeakerId(name: string, timestamp?: string): string {
  const ts = timestamp || String(Date.now())
  const content = `${name}_${ts}`
  return crypto.createHash('md5').update(content).digest('hex')
}

async function migrateVoiceprints() {
  try {
    // 连接数据库
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-agent'
    await mongoose.connect(mongoUri)
    logger.info('数据库连接成功')

    // 查找所有缺少 speakerId 的声纹
    const voiceprintsWithoutSpeakerId = await Voiceprint.find({
      $or: [
        { speakerId: { $exists: false } },
        { speakerId: null },
        { speakerId: '' }
      ]
    })

    logger.info(`找到 ${voiceprintsWithoutSpeakerId.length} 条需要迁移的声纹数据`)

    if (voiceprintsWithoutSpeakerId.length === 0) {
      logger.info('所有声纹数据都已有 speakerId，无需迁移')
      return
    }

    // 迁移统计
    let successCount = 0
    let errorCount = 0
    const errors: Array<{ id: string; name: string; error: string }> = []

    // 为每条数据生成并添加 speakerId
    for (const voiceprint of voiceprintsWithoutSpeakerId) {
      try {
        // 使用创建时间作为时间戳，确保生成的 speakerId 稳定
        const timestamp = voiceprint.createdAt ? String(new Date(voiceprint.createdAt).getTime()) : undefined
        const speakerId = generateSpeakerId(voiceprint.name, timestamp)

        // 检查是否有重复的 speakerId
        const existing = await Voiceprint.findOne({ speakerId })
        if (existing && existing._id.toString() !== voiceprint._id.toString()) {
          // 如果有重复，添加随机后缀
          const uniqueSpeakerId = generateSpeakerId(voiceprint.name, String(Date.now()))
          voiceprint.speakerId = uniqueSpeakerId
          logger.warn(`声纹 ${voiceprint.name} (${voiceprint._id}) 生成了重复的 speakerId，使用随机ID: ${uniqueSpeakerId}`)
        } else {
          voiceprint.speakerId = speakerId
        }

        await voiceprint.save()

        successCount++
        logger.info(`✓ 迁移成功: ${voiceprint.name} (${voiceprint._id}) -> speakerId: ${voiceprint.speakerId}`)
      } catch (error: any) {
        errorCount++
        const errorMsg = error.message || String(error)
        errors.push({
          id: voiceprint._id.toString(),
          name: voiceprint.name,
          error: errorMsg
        })
        logger.error(`✗ 迁移失败: ${voiceprint.name} (${voiceprint._id}): ${errorMsg}`)
      }
    }

    // 输出迁移总结
    logger.info('\n=== 迁移总结 ===')
    logger.info(`总计: ${voiceprintsWithoutSpeakerId.length} 条`)
    logger.info(`成功: ${successCount} 条`)
    logger.info(`失败: ${errorCount} 条`)

    if (errors.length > 0) {
      logger.error('\n失败的记录:')
      errors.forEach(err => {
        logger.error(`  - ${err.name} (${err.id}): ${err.error}`)
      })
    }

    // 验证迁移结果
    const remaining = await Voiceprint.countDocuments({
      $or: [
        { speakerId: { $exists: false } },
        { speakerId: null },
        { speakerId: '' }
      ]
    })

    if (remaining === 0) {
      logger.info('\n✅ 所有声纹数据迁移完成！')
    } else {
      logger.warn(`\n⚠️  还有 ${remaining} 条声纹数据缺少 speakerId`)
    }

  } catch (error: any) {
    logger.error('迁移过程出错:', error)
    throw error
  } finally {
    await mongoose.connection.close()
    logger.info('数据库连接已关闭')
  }
}

// 运行迁移
migrateVoiceprints()
  .then(() => {
    logger.info('迁移脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('迁移脚本执行失败:', error)
    process.exit(1)
  })
