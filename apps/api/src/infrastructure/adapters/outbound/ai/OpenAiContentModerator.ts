import { z } from 'zod'
import { AppError } from '../../inbound/middleware/errorHandler.js'

const resultSchema = z.object({
  results: z.array(z.object({ flagged: z.boolean() })).length(1),
})

/** Screening is required: unavailable or malformed results never mean approval. */
export class OpenAiContentModerator {
  constructor(private readonly apiKey: string) {}

  async assertAllowed(text: string): Promise<void> {
    if (!this.apiKey) throw new AppError('Content screening is unavailable. Please try again later.', 503)
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
      })
    } catch {
      throw new AppError('Content screening could not finish. Please try again later.', 502)
    }
    if (!response.ok) throw new AppError('Content screening is temporarily unavailable. Please try again later.', 502)
    let flagged: boolean
    try {
      flagged = resultSchema.parse(await response.json()).results[0].flagged
    } catch {
      throw new AppError('Content screening could not finish. Please try again later.', 502)
    }
    if (flagged) {
      throw new AppError('This writing request or suggestion needs safety review and cannot be returned. You can revise your text or contact support for help.', 422)
    }
  }
}
