import type { AiWritingRequest, AiWritingResponse } from '@ubuntu-fund/types'
import { AI_WRITING_TIMEOUT_MS, api } from './api'

/**
 * Ask for a writing suggestion. Waits for the server's whole moderation and
 * generation budget instead of the default request deadline, so a slow but
 * successful suggestion (which already used a daily request) is not lost.
 */
export function requestAiWriting(input: AiWritingRequest): Promise<AiWritingResponse> {
  return api.post<AiWritingResponse>('/ai-writing', input, undefined, AI_WRITING_TIMEOUT_MS)
}
