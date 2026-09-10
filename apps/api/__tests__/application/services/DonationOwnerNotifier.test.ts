import { describe, expect, it, vi } from 'vitest';
import { DonationOwnerNotifier } from '../../../src/application/services/DonationOwnerNotifier.js';
import { OutboxDispatcher } from '../../../src/application/services/OutboxDispatcher.js';
import type { DonationSucceededPayload } from '@ubuntu-fund/types';
const payload: DonationSucceededPayload = { donationId: 'gift1', donationIntentId: 'intent1', campaignId: 'campaign', donorId: 'guest', donorName: 'Donor', amount: 200, currency: 'GHS', isAnonymous: false, createdAt: new Date().toISOString() };
function setup() {
  const campaign = { findById: vi.fn(async () => ({ creatorId: 'owner', title: 'A campaign' })) };
  const notifications = { save: vi.fn(async n => n) };
  const email = { send: vi.fn(async () => {}) };
  const notifier = new DonationOwnerNotifier(campaign as never, notifications as never, email);
  return { notifier, campaign, notifications, email };
}
describe('donation owner notifications', () => {
  it('delivers to the owner even for a guest gift', async () => {
    const f = setup(); await f.notifier.notify(payload);
    expect(f.notifications.save.mock.calls[0][0].toPlain()).toMatchObject({ userId: 'owner', type: 'donation_received', body: expect.stringContaining('200') });
    expect(f.email.send).toHaveBeenCalledWith('owner', expect.any(String), expect.any(String), expect.stringContaining('A campaign'));
  });
  it('uses the same inbox ID on retries and a different ID for a different gift', async () => {
    const f = setup(); await f.notifier.notify(payload); await f.notifier.notify(payload); await f.notifier.notify({ ...payload, donationId: 'gift2' });
    const ids = f.notifications.save.mock.calls.map(([n]) => n.id);
    expect(ids[0]).toBe(ids[1]); expect(ids[0]).not.toBe(ids[2]);
  });
  it('does not reveal an anonymous donor name in either channel', async () => {
    const f = setup(); await f.notifier.notify({ ...payload, isAnonymous: true, donorName: 'Secret identity' });
    expect(f.notifications.save.mock.calls[0][0].body).not.toContain('Secret identity');
    expect(f.email.send.mock.calls[0][3]).toContain('anonymous supporter');
  });
  it('keeps failed notification delivery pending for an outbox retry', async () => {
    const repo = { markDispatched: vi.fn(), recordAttempt: vi.fn() };
    const notifier = { notify: vi.fn().mockRejectedValue(new Error('mail unavailable')) };
    const dispatcher = new OutboxDispatcher(repo as never, { recordDonationRealtime: vi.fn() } as never, notifier as never);
    await dispatcher.dispatch({ id: 'event', status: 'pending', type: 'donation.succeeded', payload } as never);
    expect(repo.markDispatched).not.toHaveBeenCalled(); expect(repo.recordAttempt).toHaveBeenCalledWith('event');
  });
});
