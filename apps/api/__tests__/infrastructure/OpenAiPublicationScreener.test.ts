import { afterEach, expect, it, vi } from 'vitest';
import { OpenAiPublicationScreener } from '../../src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.js';
afterEach(() => vi.unstubAllGlobals());
it('sends only the supplied public text and rejects malformed or failed provider replies', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ flagged: false }] }) });
  vi.stubGlobal('fetch', fetcher);
  const screener = new OpenAiPublicationScreener('fixture-key');
  expect(await screener.screen('Proposed public text')).toBe('allowed');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ model: 'omni-moderation-latest', input: 'Proposed public text' });
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ flagged: true }] }) });
  expect(await screener.screen('Flagged fixture')).toBe('flagged');
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ results: [] }) }, { ok: true, json: async () => ({ results: [{ flagged: 'false' }] }) }]) {
    fetcher.mockResolvedValueOnce(response);
    await expect(screener.screen('Text')).rejects.toThrow();
  }
  fetcher.mockRejectedValueOnce(new Error('Network failure'));
  await expect(screener.screen('Text')).rejects.toThrow();
});
it('never sends a request without a configured key', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(new OpenAiPublicationScreener('').screen('Text')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
