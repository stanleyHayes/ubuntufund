import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { CollaborationModel } from '../../../database/models/CollaborationModel.js';
import type { HeldCollaborationInvitations } from '../../../../application/use-cases/InviteCollaboratorUseCase.js';
import { recordAccountNotice } from './campaignManagers.js';

/**
 * Announces the collaborator invitations of a campaign that were recorded
 * while its content waited for a staff check. Each is announced once: the
 * notice is keyed by the invitation, and the hold is removed with it. Runs in
 * the caller's transaction (the staff approval) when there is one.
 */
export async function announceHeldCollaborations(campaignId: string, title: string): Promise<number> {
  const held = await CollaborationModel.find({ campaignId, status: 'pending', heldForContentCheck: true }).select('_id userId').lean();
  for (const collaboration of held) {
    await recordAccountNotice({ key: `collaboration-invitation:${collaboration._id}:released`, userId: collaboration.userId, type: 'collaboration_invitation',
      title: 'Campaign invitation', body: `You were invited to be listed as a collaborator on "${title}". Review it in Invitations.`, path: '/invitations' });
    await CollaborationModel.updateOne({ _id: collaboration._id, heldForContentCheck: true }, { $unset: { heldForContentCheck: 1 } });
  }
  return held.length;
}

/**
 * The invitation side of the race with a staff approval. The invitation is
 * saved outside any transaction, so an approval running at the same moment
 * may not see it. After saving a held invitation, this writes the campaign
 * while its check is still outstanding: an approval that writes the campaign
 * too then conflicts with it (and retries, finding the invitation), or it
 * already committed, the filter no longer matches, and the invitation is
 * announced here instead, with the same notice key.
 */
export class MongoHeldCollaborations implements HeldCollaborationInvitations {
  async settle(campaignId: string): Promise<void> {
    const fence = await CampaignModel.updateOne(
      { _id: campaignId, contentReviewReason: { $exists: true }, contentReviewClearedAt: { $exists: false } },
      { $inc: { collaborationWriteVersion: 1 } }, { timestamps: false },
    );
    if (fence.matchedCount) return;
    const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } }).select('title').lean();
    if (campaign) await announceHeldCollaborations(campaignId, campaign.title);
  }
}
