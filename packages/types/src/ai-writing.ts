export enum AiWritingAction {
  FORMALIZE = 'FORMALIZE',
  SUMMARIZE = 'SUMMARIZE',
  CASUAL = 'CASUAL',
  EXPAND = 'EXPAND',
  FIX_GRAMMAR = 'FIX_GRAMMAR',
  CREATE_FROM_PROMPT = 'CREATE_FROM_PROMPT',
  IMPROVE_CLARITY = 'IMPROVE_CLARITY',
  GENERATE_TITLE = 'GENERATE_TITLE',
  GENERATE_EMAIL = 'GENERATE_EMAIL',
  TRANSLATE = 'TRANSLATE',
}

export interface AiWritingRequest {
  text: string
  action: AiWritingAction
  prompt?: string
  targetLanguage?: string
}

export interface AiWritingResponse {
  result: string
  action: AiWritingAction
  originalLength: number
  resultLength: number
  remainingRequests?: number
}

export interface AiUsageStats {
  userId: string
  totalRequests: number
  requestsToday: number
  requestsThisMonth: number
  lastUsedAt: string | null
  enabled: boolean
  inputTokens: number
  outputTokens: number
  errors: number
}

export interface AiUsageLogEntry {
  id: string
  action: AiWritingAction
  timestamp: string
  userId: string
  model: string
  inputTokens: number
  outputTokens: number
  inputLength: number
  outputLength: number
  status: 'pending' | 'success' | 'error'
}
