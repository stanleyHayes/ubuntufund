import { z } from 'zod';
import type { PublicationTextScreener } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
const resultSchema = z.object({ results: z.array(z.object({ flagged: z.boolean() })).length(1) });

/** Only explicitly opted-in public text reaches this adapter. Media goes to staff. */
export class OpenAiPublicationScreener implements PublicationTextScreener {
  constructor(private readonly apiKey: string) {}
  async screen(text: string): Promise<'allowed' | 'flagged'> {
    if (!this.apiKey) throw new Error('Publication screening is unavailable');
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!response.ok) throw new Error('Publication screening is unavailable');
    return resultSchema.parse(await response.json()).results[0].flagged ? 'flagged' : 'allowed';
  }
}
