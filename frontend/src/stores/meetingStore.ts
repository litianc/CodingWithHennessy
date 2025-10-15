import { create } from 'zustand'
import { Meeting, Participant, TranscriptionSegment } from '@/types'

interface MeetingState {
  currentMeeting: Meeting | null
  meetings: Meeting[]
  isLoading: boolean
  isRecording: boolean
  isTranscribing: boolean
  transcriptionSegments: TranscriptionSegment[]
  participants: Participant[]

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
  addParticipant: (participant: Participant) => void
  removeParticipant: (participantId: string) => void
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void

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

  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants, participant]
  })),

  removeParticipant: (participantId) => set((state) => ({
    participants: state.participants.filter(p => p.id !== participantId)
  })),

  updateParticipant: (participantId, updates) => set((state) => ({
    participants: state.participants.map(participant =>
      participant.id === participantId ? { ...participant, ...updates } : participant
    )
  })),

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
}))