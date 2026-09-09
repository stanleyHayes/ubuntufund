import { describe, it, expect, vi } from 'vitest';
import { TokenVerifier } from 'livekit-server-sdk';
import { LiveVideoService } from '../../src/infrastructure/adapters/outbound/video/LiveVideoService.js';
const controls = vi.hoisted(() => ({ deleteRoom: vi.fn() }));
vi.mock('livekit-server-sdk', async importOriginal => ({ ...await importOriginal<typeof import('livekit-server-sdk')>(), RoomServiceClient: class { deleteRoom = controls.deleteRoom } }));
const settings = { url: 'wss://video.example.test', apiKey: 'test-key', apiSecret: 'test-secret-for-local-signature-verification' };
const session = { id: 'session', campaignId: 'campaign', isActive: () => true };
const sessions = { findById: async () => session } as any;
const campaigns = { findById: async () => ({ creatorId: 'owner', canReceiveDonation: () => true }) } as any;
describe('live video permissions', () => {
  it('signs host publishing grants and watch-only guest grants for the same room', async () => {
    const service = new LiveVideoService(settings, sessions, campaigns);
    const verifier = new TokenVerifier(settings.apiKey, settings.apiSecret);
    const host = await service.join('session', 'owner');
    const viewer = await service.join('session');
    const h = await verifier.verify(host.token); const v = await verifier.verify(viewer.token);
    expect(h.video).toMatchObject({ room: 'ujimora-session', canPublish: true, canSubscribe: true, canPublishData: false });
    expect(v.video).toMatchObject({ room: 'ujimora-session', canPublish: false, canSubscribe: true, canPublishData: false });
    expect(h.sub).toBe('host-owner'); expect(v.sub).toMatch(/^viewer-/);
    expect(v.exp! - v.nbf!).toBeLessThanOrEqual(60);
    expect(host).not.toHaveProperty('apiSecret');
  });
  it('closes the provider room and surfaces failure so the owner can retry', async () => {
    const service = new LiveVideoService(settings, sessions, campaigns);
    controls.deleteRoom.mockResolvedValueOnce(undefined); await service.closeRoom('session');
    expect(controls.deleteRoom).toHaveBeenCalledWith('ujimora-session');
    controls.deleteRoom.mockRejectedValueOnce(new Error('unavailable'));
    await expect(service.closeRoom('session')).rejects.toMatchObject({ statusCode: 502 });
  });
  it('rejects foreign hosts, closed sessions and missing provider configuration', async () => {
    await expect(new LiveVideoService(settings, sessions, campaigns).join('session', 'intruder')).rejects.toMatchObject({ statusCode: 403 });
    await expect(new LiveVideoService(settings, { findById: async () => ({ ...session, isActive: () => false }) } as any, campaigns).join('session')).rejects.toMatchObject({ statusCode: 409 });
    await expect(new LiveVideoService({ ...settings, apiKey: '' }, sessions, campaigns).join('session')).rejects.toMatchObject({ statusCode: 503 });
  });
});
