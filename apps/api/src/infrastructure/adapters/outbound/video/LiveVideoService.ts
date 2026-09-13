import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { LiveSessionRepositoryPort } from '../../../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export interface LiveVideoConfig { url: string; apiKey: string; apiSecret: string }
/** Credentials remain server-side. Viewers can subscribe but cannot publish tracks or data. */
export class LiveVideoService {
  constructor(private readonly config: LiveVideoConfig, private readonly sessions: LiveSessionRepositoryPort, private readonly campaigns: CampaignRepositoryPort, private readonly safety?: { recordHostToken?(id: string): Promise<void>; assertOwnerVisible(ownerId: string, viewerId?: string): Promise<void>; assertSessionVisible(sessionId: string, viewerId?: string): Promise<void> }) {}
  get enabled() { return /^wss:\/\//.test(this.config.url) && !!this.config.apiKey && !!this.config.apiSecret; }
  async join(sessionId: string, hostId?: string, viewerId?: string) {
    if (!this.enabled) throw new AppError('Live video is not configured yet', 503);
    const session = await this.sessions.findById(sessionId);
    if (!session || !session.isActive()) throw new AppError('This broadcast has ended or is unavailable', 409);
    const campaign = await this.campaigns.findById(session.campaignId);
    if (!campaign || !campaign.canReceiveDonation()) throw new AppError('This campaign is not available to broadcast', 409);
    if (hostId && campaign.creatorId !== hostId) throw new AppError('Only the campaign owner can broadcast', 403);
    await this.safety?.assertSessionVisible(sessionId, viewerId);
    await this.safety?.assertOwnerVisible(campaign.creatorId, viewerId);
    if (hostId) await this.safety?.recordHostToken?.(sessionId);
    const identity = hostId ? `host-${hostId}` : `viewer-${viewerId ?? randomUUID()}`;
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, { identity, ttl: '1m', name: hostId ? 'Campaign host' : 'Viewer' });
    token.addGrant({ room: `ujimora-${session.id}`, roomJoin: true, canSubscribe: true, canPublish: !!hostId, canPublishData: false });
    return { serverUrl: this.config.url, token: await token.toJwt(), role: hostId ? 'host' : 'viewer' };
  }
  async removeIdentity(sessionId: string, identity: string) {
    if (!this.enabled) return;
    const rooms = new RoomServiceClient(this.config.url.replace(/^wss:/, 'https:'), this.config.apiKey, this.config.apiSecret);
    try { await rooms.removeParticipant(`ujimora-${sessionId}`, identity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }); }
    catch (error) {
      const e = error as { status?: number; code?: string };
      if (e.status !== 404 && e.code !== 'not_found') throw new AppError('Video access cleanup is pending. Please retry.', 502);
    }
  }
  async closeRoom(sessionId: string) {
    if (!this.enabled) return;
    const rooms = new RoomServiceClient(this.config.url.replace(/^wss:/, 'https:'), this.config.apiKey, this.config.apiSecret);
    try { await rooms.deleteRoom(`ujimora-${sessionId}`); }
    catch (error) {
      const e = error as { status?: number; code?: string };
      if (e.status !== 404 && e.code !== 'not_found') throw new AppError('Could not stop the video broadcast. Please retry ending the session.', 502);
    }
  }
}
