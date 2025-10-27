/**
 * 声纹管理服务
 * 与3D Speaker后端API交互
 */
import axios from 'axios'

const SPEAKER_API_BASE_URL = 'http://localhost:5002/api'

export interface Voiceprint {
  speaker_id: string
  name: string
  user_id?: string
  email?: string
  created_at: string
  sample_count: number
}

export interface VoiceprintRegistrationData {
  name: string
  user_id?: string
  email?: string
  audio: File
}

export interface RecognitionResult {
  speaker_id: string
  name: string
  user_id?: string
  email?: string
  similarity: number
  confidence: number
  is_match: boolean
}

/**
 * 获取所有已注册声纹列表
 */
export const getVoiceprints = async (): Promise<Voiceprint[]> => {
  try {
    const response = await axios.get(`${SPEAKER_API_BASE_URL}/speaker/list`)
    return response.data.data?.speakers || []
  } catch (error) {
    console.error('获取声纹列表失败:', error)
    throw error
  }
}

/**
 * 注册新声纹
 */
export const registerVoiceprint = async (data: VoiceprintRegistrationData): Promise<any> => {
  try {
    const formData = new FormData()
    formData.append('name', data.name)
    formData.append('audio', data.audio)
    if (data.user_id) {
      formData.append('user_id', data.user_id)
    }
    if (data.email) {
      formData.append('email', data.email)
    }

    const response = await axios.post(
      `${SPEAKER_API_BASE_URL}/speaker/register`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('声纹注册失败:', error)
    throw error
  }
}

/**
 * 删除声纹
 */
export const deleteVoiceprint = async (speakerId: string): Promise<void> => {
  try {
    await axios.delete(`${SPEAKER_API_BASE_URL}/speaker/${speakerId}`)
  } catch (error) {
    console.error('删除声纹失败:', error)
    throw error
  }
}

/**
 * 更新声纹信息
 */
export const updateVoiceprint = async (
  speakerId: string,
  data: { name?: string; user_id?: string; email?: string }
): Promise<void> => {
  try {
    await axios.put(`${SPEAKER_API_BASE_URL}/speaker/${speakerId}`, data)
  } catch (error) {
    console.error('更新声纹失败:', error)
    throw error
  }
}

/**
 * 识别声纹
 */
export const recognizeVoice = async (audioFile: File): Promise<RecognitionResult> => {
  try {
    const formData = new FormData()
    formData.append('audio', audioFile)

    const response = await axios.post(
      `${SPEAKER_API_BASE_URL}/speaker/recognize`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data.data
  } catch (error) {
    console.error('声纹识别失败:', error)
    throw error
  }
}

/**
 * 获取服务健康状态
 */
export const getSpeakerServiceHealth = async () => {
  try {
    const response = await axios.get(`${SPEAKER_API_BASE_URL}/health`)
    return response.data
  } catch (error) {
    console.error('获取服务状态失败:', error)
    throw error
  }
}
