import type { PublicProfileVisibilityPort } from '../../../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { UserBlockRepositoryPort } from '../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ProfileModel } from '../../../database/models/ProfileModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';

export class MongoPublicProfileVisibility implements PublicProfileVisibilityPort {
  constructor(private readonly blocks: UserBlockRepositoryPort) {}

  async hiddenUserIds(userIds: string[], viewerId?: string): Promise<Set<string>> {
    return this.hiddenIds(userIds, viewerId, true);
  }

  async hiddenContentAuthorIds(userIds: string[], viewerId?: string): Promise<Set<string>> {
    return this.hiddenIds(userIds, viewerId, false);
  }

  private async hiddenIds(userIds: string[], viewerId: string | undefined, includePrivateProfiles: boolean): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const validIds = [...new Set(userIds)].filter(id => /^[a-f0-9]{24}$/i.test(id));
    const [active, privateProfiles, restrictions, blocked] = await Promise.all([
      UserModel.find({ _id: { $in: validIds }, deletedAt: null }).select('_id').lean(),
      includePrivateProfiles ? ProfileModel.find({ userId: { $in: userIds }, publicProfile: false }).select('userId').lean() : Promise.resolve([]),
      ContentRestrictionModel.find({ userId: { $in: userIds } }).select('userId').lean(),
      viewerId ? this.blocks.excludedUserIds(viewerId) : Promise.resolve([]),
    ]);
    const activeIds = new Set(active.map(user => String(user._id)));
    return new Set([
      ...userIds.filter(id => !activeIds.has(id)),
      ...privateProfiles.map(profile => profile.userId),
      ...restrictions.map(restriction => restriction.userId),
      ...blocked,
    ]);
  }
}
