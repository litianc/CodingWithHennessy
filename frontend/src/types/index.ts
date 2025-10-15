// 通用类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 会议相关类型
export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  participants: Participant[];
  recordings: Recording[];
  transcriptions: TranscriptionSegment[];
  minutes?: MeetingMinutes;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'host' | 'participant' | 'observer';
  avatar?: string;
  voiceprintId?: string;
  joinedAt?: Date;
  leftAt?: Date;
}

export interface Recording {
  id: string;
  meetingId: string;
  filename: string;
  duration: number;
  size: number;
  format: string;
  url: string;
  createdAt: Date;
}

// 转录相关类型
export interface TranscriptionSegment {
  id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  content: string;
  timestamp: Date;
  confidence: number;
  isComplete: boolean;
  startTime: number;
  endTime: number;
}

// 会议纪要类型
export interface MeetingMinutes {
  id: string;
  meetingId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: Decision[];
  nextSteps: string[];
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'reviewing' | 'approved' | 'sent';
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface Decision {
  id: string;
  description: string;
  decisionMaker: string;
  timestamp: Date;
  impact: string;
}

// 声纹相关类型
export interface Voiceprint {
  id: string;
  userId: string;
  name: string;
  features: number[];
  sampleRate: number;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface VoiceEnrollment {
  id: string;
  voiceprintId: string;
  audioData: ArrayBuffer;
  quality: number;
  confidence: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  meetingId?: string;
}

export interface TranscriptionMessage extends WebSocketMessage {
  type: 'transcription';
  payload: {
    segment: TranscriptionSegment;
    isLive: boolean;
  };
}

export interface MeetingStatusMessage extends WebSocketMessage {
  type: 'meeting_status';
  payload: {
    status: Meeting['status'];
    participantCount: number;
    recordingDuration?: number;
  };
}

export interface VoiceprintMessage extends WebSocketMessage {
  type: 'voiceprint_update';
  payload: {
    speakerId: string;
    speakerName: string;
    confidence: number;
  };
}

// AI 聊天相关类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  meetingId?: string;
}

export interface ChatSession {
  id: string;
  meetingId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// 邮件相关类型
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface EmailSendRequest {
  meetingId: string;
  recipients: string[];
  template?: string;
  customSubject?: string;
  customBody?: string;
  includeMinutes: boolean;
  includeRecordings: boolean;
}

export interface EmailStatus {
  id: string;
  meetingId: string;
  recipients: string[];
  status: 'pending' | 'sending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}

// UI 状态类型
export interface UIState {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  sidebarCollapsed: boolean;
  activeTab: string;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  persistent: boolean;
  createdAt: Date;
  read: boolean;
}

// 录音状态类型
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  startTime?: Date;
  stream?: MediaStream;
  error?: string;
}

// 设置类型
export interface UserSettings {
  id: string;
  userId: string;
  language: string;
  theme: string;
  autoRecord: boolean;
  emailNotifications: boolean;
  soundAlerts: boolean;
  voiceprintEnabled: boolean;
  transcriptionLanguage: string;
  minutesTemplate: string;
  emailSignature: string;
  createdAt: Date;
  updatedAt: Date;
}

// API 请求/响应类型
export interface CreateMeetingRequest {
  title: string;
  description?: string;
  scheduledTime?: Date;
  participants?: Omit<Participant, 'id' | 'joinedAt' | 'leftAt'>[];
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  status?: Meeting['status'];
  participants?: Omit<Participant, 'id' | 'joinedAt' | 'leftAt'>[];
}

export interface JoinMeetingRequest {
  meetingId: string;
  participant: Omit<Participant, 'id' | 'joinedAt' | 'leftAt'>;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// 分页类型
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}