import { create } from 'zustand'
import { Meeting, Participant, TranscriptionSegment, ChatMessage, MeetingMinutes } from '@/types'

interface MeetingState {
  currentMeeting: Meeting | null
  meetings: Meeting[]
  isLoading: boolean
  isRecording: boolean
  isTranscribing: boolean
  transcriptionSegments: TranscriptionSegment[]
  participants: Participant[]
  chatHistory: Record<string, ChatMessage[]>
  loading: boolean

  // Actions
  setCurrentMeeting: (meeting: Meeting | null) => void
  setMeetings: (meetings: Meeting[]) => void
  addMeeting: (meeting: Meeting) => void
  updateMeeting: (meetingId: string, updates: Partial<Meeting>) => void
  removeMeeting: (meetingId: string) => void

  // Recording actions
  setRecording: (isRecording: boolean) => void
  setTranscribing: (isTranscribing: boolean) => void

  // Transcription actions
  addTranscriptionSegment: (segment: TranscriptionSegment) => void
  updateTranscriptionSegment: (segmentId: string, updates: Partial<TranscriptionSegment>) => void
  clearTranscriptionSegments: () => void

  // Participant actions
  setParticipants: (participants: Participant[]) => void
  addParticipant: (meetingId: string, participantData: { email: string; name?: string; role?: 'participant' | 'moderator' }) => Promise<void>
  removeParticipant: (meetingId: string, participantId: string) => Promise<void>
  updateParticipant: (meetingId: string, participantId: string, updates: { name?: string; role?: 'participant' | 'moderator' }) => Promise<void>

  // Chat actions
  sendChatMessage: (meetingId: string, message: string) => Promise<void>
  clearChatHistory: (meetingId: string) => void

  // Minutes actions
  updateMeetingMinutes: (meetingId: string, minutes: Partial<MeetingMinutes>) => Promise<void>

  // Fetch actions
  fetchMeetings: () => Promise<void>
  fetchMeeting: (meetingId: string) => Promise<void>
  createMeeting: (meetingData: CreateMeetingData) => Promise<Meeting>
  joinMeeting: (meetingId: string) => Promise<void>
  leaveMeeting: (meetingId: string) => Promise<void>
  startMeeting: (meetingId: string) => Promise<void>
  endMeeting: (meetingId: string) => Promise<void>
}

interface CreateMeetingData {
  title: string
  description?: string
  participants?: Partial<Participant>[]
  scheduledStartTime?: Date
  scheduledEndTime?: Date
  settings?: {
    allowRecording?: boolean
    enableTranscription?: boolean
    enableVoiceprint?: boolean
    autoGenerateMinutes?: boolean
    language?: string
  }
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  currentMeeting: null,
  meetings: [],
  isLoading: false,
  isRecording: false,
  isTranscribing: false,
  transcriptionSegments: [],
  participants: [],
  chatHistory: {},
  loading: false,

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),

  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (meeting) => set((state) => ({
    meetings: [meeting, ...state.meetings]
  })),

  updateMeeting: (meetingId, updates) => set((state) => ({
    currentMeeting: state.currentMeeting?._id === meetingId
      ? { ...state.currentMeeting, ...updates }
      : state.currentMeeting,
    meetings: state.meetings.map(meeting =>
      meeting._id === meetingId ? { ...meeting, ...updates } : meeting
    )
  })),

  removeMeeting: (meetingId) => set((state) => ({
    meetings: state.meetings.filter(meeting => meeting._id !== meetingId),
    currentMeeting: state.currentMeeting?._id === meetingId ? null : state.currentMeeting
  })),

  setRecording: (isRecording) => set({ isRecording }),

  setTranscribing: (isTranscribing) => set({ isTranscribing }),

  addTranscriptionSegment: (segment) => set((state) => ({
    transcriptionSegments: [...state.transcriptionSegments, segment]
  })),

  updateTranscriptionSegment: (segmentId, updates) => set((state) => ({
    transcriptionSegments: state.transcriptionSegments.map(segment =>
      segment.id === segmentId ? { ...segment, ...updates } : segment
    )
  })),

  clearTranscriptionSegments: () => set({ transcriptionSegments: [] }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: async (meetingId, participantData) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(participantData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '添加参与者失败')
      }

      const data = await response.json()
      const newParticipant = data.data.participant

      // 更新本地状态
      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId
          ? {
              ...state.currentMeeting,
              participants: [...(state.currentMeeting.participants || []), newParticipant]
            }
          : state.currentMeeting,
        participants: [...state.participants, newParticipant]
      }))
    } catch (error) {
      throw error
    }
  },

  removeParticipant: async (meetingId, participantId) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/participants/${participantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '移除参与者失败')
      }

      // 更新本地状态
      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId
          ? {
              ...state.currentMeeting,
              participants: (state.currentMeeting.participants || []).filter(p => p.id !== participantId)
            }
          : state.currentMeeting,
        participants: state.participants.filter(p => p.id !== participantId)
      }))
    } catch (error) {
      throw error
    }
  },

  updateParticipant: async (meetingId, participantId, updates) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/participants/${participantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新参与者失败')
      }

      const data = await response.json()
      const updatedParticipant = data.data.participant

      // 更新本地状态
      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId
          ? {
              ...state.currentMeeting,
              participants: (state.currentMeeting.participants || []).map(p =>
                p.id === participantId ? { ...p, ...updatedParticipant } : p
              )
            }
          : state.currentMeeting,
        participants: state.participants.map(p =>
          p.id === participantId ? { ...p, ...updatedParticipant } : p
        )
      }))
    } catch (error) {
      throw error
    }
  },

  fetchMeetings: async () => {
    set({ isLoading: true })
    try {
      const response = await fetch('/api/meetings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) throw new Error('获取会议列表失败')

      const data = await response.json()
      set({ meetings: data.data.meetings, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  fetchMeeting: async (meetingId: string) => {
    set({ isLoading: true })
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) throw new Error('获取会议详情失败')

      const data = await response.json()
      const meeting = data.data.meeting

      set({
        currentMeeting: meeting,
        transcriptionSegments: meeting.transcriptions || [],
        participants: meeting.participants || [],
        isLoading: false
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createMeeting: async (meetingData) => {
    set({ isLoading: true })
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(meetingData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '创建会议失败')
      }

      const data = await response.json()
      const meeting = data.data.meeting

      set((state) => ({
        meetings: [meeting, ...state.meetings],
        currentMeeting: meeting,
        isLoading: false
      }))

      return meeting
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  joinMeeting: async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '加入会议失败')
      }

      const data = await response.json()
      const meeting = data.data.meeting

      set({ currentMeeting: meeting })
    } catch (error) {
      throw error
    }
  },

  leaveMeeting: async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '离开会议失败')
      }

      set({ currentMeeting: null })
    } catch (error) {
      throw error
    }
  },

  startMeeting: async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '开始会议失败')
      }

      const data = await response.json()
      const meeting = data.data.meeting

      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId ? meeting : state.currentMeeting,
        meetings: state.meetings.map(m => m._id === meetingId ? meeting : m)
      }))
    } catch (error) {
      throw error
    }
  },

  endMeeting: async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '结束会议失败')
      }

      const data = await response.json()
      const meeting = data.data.meeting

      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId ? meeting : state.currentMeeting,
        meetings: state.meetings.map(m => m._id === meetingId ? meeting : m),
        isRecording: false,
        isTranscribing: false
      }))
    } catch (error) {
      throw error
    }
  },

  sendChatMessage: async (meetingId: string, message: string) => {
    const state = get()
    const currentHistory = state.chatHistory[meetingId] || []

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      timestamp: new Date()
    }

    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [meetingId]: [...(state.chatHistory[meetingId] || []), userMessage]
      },
      loading: true
    }))

    try {
      const response = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '发送消息失败')
      }

      const data = await response.json()
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date()
      }

      set((state) => ({
        chatHistory: {
          ...state.chatHistory,
          [meetingId]: [...(state.chatHistory[meetingId] || []), assistantMessage]
        },
        loading: false
      }))
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  clearChatHistory: (meetingId: string) => {
    set((state) => ({
      chatHistory: {
        ...state.chatHistory,
        [meetingId]: []
      }
    }))
  },

  updateMeetingMinutes: async (meetingId: string, minutes: Partial<MeetingMinutes>) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/minutes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(minutes),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新会议纪要失败')
      }

      const data = await response.json()
      const updatedMinutes = data.data.minutes

      // 只更新纪要字段，不刷新整个会议对象
      set((state) => ({
        currentMeeting: state.currentMeeting?._id === meetingId
          ? { ...state.currentMeeting, minutes: updatedMinutes }
          : state.currentMeeting,
        meetings: state.meetings.map(m =>
          m._id === meetingId ? { ...m, minutes: updatedMinutes } : m
        )
      }))
    } catch (error) {
      throw error
    }
  },
}))