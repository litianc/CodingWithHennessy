/**
 * 检查声纹数据状态
 *
 * 使用方法：
 * npx ts-node scripts/check-voiceprints.ts
 */

import mongoose from 'mongoose'
import { Voiceprint } from '../src/models/Voiceprint'
import { logger } from '../src/utils/logger'

async function checkVoiceprints() {
  try {
    // 连接数据库
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-agent'
    await mongoose.connect(mongoUri)
    logger.info('数据库连接成功')

    // 统计总数
    const totalCount = await Voiceprint.countDocuments()
    logger.info(`\n总声纹数量: ${totalCount}`)

    if (totalCount === 0) {
      logger.info('数据库中没有声纹数据')
      return
    }

    // 统计有 speakerId 的数量
    const withSpeakerIdCount = await Voiceprint.countDocuments({
      speakerId: { $exists: true, $nin: [null, ''] }
    })
    logger.info(`有 speakerId: ${withSpeakerIdCount}`)

    // 统计缺少 speakerId 的数量
    const withoutSpeakerIdCount = await Voiceprint.countDocuments({
      $or: [
        { speakerId: { $exists: false } },
        { speakerId: null },
        { speakerId: '' }
      ]
    })
    logger.info(`缺少 speakerId: ${withoutSpeakerIdCount}`)

    // 列出缺少 speakerId 的声纹
    if (withoutSpeakerIdCount > 0) {
      logger.info('\n缺少 speakerId 的声纹列表:')
      const voiceprintsWithout = await Voiceprint.find({
        $or: [
          { speakerId: { $exists: false } },
          { speakerId: null },
          { speakerId: '' }
        ]
      }).select('_id name department email createdAt')

      voiceprintsWithout.forEach((vp, index) => {
        logger.info(`${index + 1}. ${vp.name} (${vp._id})`)
        logger.info(`   部门: ${vp.department || '无'}`)
        logger.info(`   邮箱: ${vp.email || '无'}`)
        logger.info(`   创建时间: ${vp.createdAt}`)
      })
    }

    // 列出有 speakerId 的声纹（示例）
    if (withSpeakerIdCount > 0) {
      logger.info('\n有 speakerId 的声纹示例:')
      const voiceprintsWith = await Voiceprint.find({
        speakerId: { $exists: true, $nin: [null, ''] }
      })
        .select('_id name speakerId createdAt')
        .limit(5)

      voiceprintsWith.forEach((vp, index) => {
        logger.info(`${index + 1}. ${vp.name}`)
        logger.info(`   MongoDB _id: ${vp._id}`)
        logger.info(`   speakerId: ${vp.speakerId}`)
        logger.info(`   创建时间: ${vp.createdAt}`)
      })
    }

  } catch (error: any) {
    logger.error('检查过程出错:', error)
    throw error
  } finally {
    await mongoose.connection.close()
    logger.info('\n数据库连接已关闭')
  }
}

// 运行检查
checkVoiceprints()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    logger.error('检查脚本执行失败:', error)
    process.exit(1)
  })
