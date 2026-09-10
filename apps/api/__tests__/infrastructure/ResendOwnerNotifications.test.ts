import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendOwnerNotifications } from '../../src/infrastructure/adapters/outbound/ResendOwnerNotifications.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
vi.mock('../../src/infrastructure/database/models/UserModel.js', () => ({ UserModel: { findById: vi.fn() } }));
vi.mock('../../src/infrastructure/database/models/ProfileModel.js', () => ({ ProfileModel: { findOne: vi.fn() } }));
vi.mock('../../src/infrastructure/database/models/NotificationModel.js', () => ({ NotificationModel: { findById: vi.fn(), updateOne: vi.fn() } }));
const send = new ResendOwnerNotifications('re_fixture', 'Ujimora <no-reply@ujimora.com>', 'https://app.ujimora.com');
beforeEach(() => { vi.resetAllMocks(); vi.mocked(UserModel.findById).mockResolvedValue({ email: 'owner@example.com' }); vi.mocked(NotificationModel.findById).mockResolvedValue({}); vi.mocked(ProfileModel.findOne).mockResolvedValue({ notificationPreferences: { email: true, campaignUpdates: true } }); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))); });
afterEach(() => vi.unstubAllGlobals());
describe('owner email delivery', () => {
  it('sends with a stable idempotency key and records successful delivery', async () => {
    await send.send('owner', 'notice', 'Donation received', 'A gift');
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'donation-owner/notice' }) }));
    expect(NotificationModel.updateOne).toHaveBeenCalled();
  });
  it('does not resend a delivered email', async () => {
    vi.mocked(NotificationModel.findById).mockResolvedValue({ emailSentAt: new Date() });
    await send.send('owner', 'notice', 'Donation received', 'A gift'); expect(fetch).not.toHaveBeenCalled();
  });
  it('honours disabled campaign email preferences', async () => {
    vi.mocked(ProfileModel.findOne).mockResolvedValue({ notificationPreferences: { email: true, campaignUpdates: false } });
    await send.send('owner', 'notice', 'Donation received', 'A gift'); expect(fetch).not.toHaveBeenCalled();
  });
  it('leaves failed delivery eligible for retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(send.send('owner', 'notice', 'Donation received', 'A gift')).rejects.toThrow('503');
    expect(NotificationModel.updateOne).not.toHaveBeenCalled();
  });
});
