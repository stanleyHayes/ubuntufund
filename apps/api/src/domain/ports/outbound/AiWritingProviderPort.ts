import type { AiWritingRequest } from '@ubuntu-fund/types'
export interface AiWritingProviderPort {
  isConfigured(): boolean
  write(
    input: AiWritingRequest,
  ): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }>
}
