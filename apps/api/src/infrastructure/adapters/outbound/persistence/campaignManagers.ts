import { createHash } from 'node:crypto';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { NotificationModel } from '../../../database/models/NotificationModel.js';

export type CampaignManagerRole = 'owner' | 'admin' | 'editor';

/**
 * Whether a user manages a campaign: the creating account itself, or an active
 * admin/editor of the organization that created it (the same rule as
 * MongoCampaignContentWrite). Managing never implies payout authority.
 */
export async function campaignManagerRole(campaign: { creatorId: string }, userId: string | undefined): Promise<CampaignManagerRole | null> {
  if (!userId) return null;
  if (campaign.creatorId === userId) return 'owner';
  const member = await OrganizationMemberModel.findOne({ organizationId: campaign.creatorId, userId, status: 'active', role: { $in: ['admin', 'editor'] } }).lean();
  if (!member) return null;
  const org = await UserModel.exists({ _id: campaign.creatorId, role: 'organization', deletedAt: null });
  return org ? (member.role as CampaignManagerRole) : null;
}

/** Display name of the account that runs a campaign. */
export async function organizerName(creatorId: string): Promise<string> {
  const user = await UserModel.findById(creatorId).select('name organizationName').lean();
  return (user as { organizationName?: string; name?: string } | null)?.organizationName || user?.name || 'The organizer';
}

/**
 * In-app notice with an id derived from `key`, so a retried transaction or
 * request upserts the same row instead of adding a duplicate. Commits with
 * the surrounding transaction when called inside one.
 */
export async function recordAccountNotice(input: { key: string; userId: string | undefined; title: string; body: string; path: string; type: string }): Promise<void> {
  if (!input.userId || !/^[a-f0-9]{24}$/i.test(input.userId)) return;
  if (!(await UserModel.exists({ _id: input.userId, deletedAt: null }))) return;
  const id = createHash('sha256').update(`account-notice:${input.key}`).digest('hex').slice(0, 24);
  await NotificationModel.updateOne({ _id: id }, {
    $setOnInsert: { userId: input.userId, title: input.title, body: input.body, path: input.path, type: input.type, read: false },
  }, { upsert: true });
}
