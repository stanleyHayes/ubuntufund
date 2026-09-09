const assert = require('node:assert/strict');
const test = require('node:test');
const { GetCampaignBySlugUseCase } = require('../../src/application/use-cases/GetCampaignBySlugUseCase.ts');

test('legacy campaign IDs resolve through the existing public checkout endpoint', async () => {
  const id = '507f1f77bcf86cd799439011';
  const calls: string[] = [];
  const entity = { toPlain: () => ({ id, slug: '', title: 'Test', description: 'Test campaign', goalAmount: { amount: 100, currency: 'GHS' }, raisedAmount: { amount: 0 }, imageUrls: [] }) };
  const service = new GetCampaignBySlugUseCase({ findBySlug: async () => null, findById: async (value: string) => { calls.push(value); return entity; } }, 'https://app.ujimora.com');
  const result = await service.execute(id);
  assert.equal(result.id, id);
  assert.equal(result.socialPreview.canonicalUrl, `https://app.ujimora.com/c/${id}`);
  assert.deepEqual(calls, [id]);
  assert.equal(await service.execute('missing-slug'), null);
  assert.deepEqual(calls, [id]);
});
