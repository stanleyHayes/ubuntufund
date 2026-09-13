import { DonationModel, type DonationDocument } from '../../src/infrastructure/database/models/DonationModel.js';
import { donationContentVersion } from '../../src/domain/entities/donationPublicContent.js';
/** Explicit reviewed-content fixtures, never a production approval path. */
export function createReviewedDonation(input: Pick<DonationDocument, 'campaignId' | 'donorId' | 'amount' | 'currency'> & Partial<DonationDocument>) {
  const content = { ...input, isAnonymous: input.isAnonymous ?? false };
  return DonationModel.create({ ...content, publicContentStatus: 'approved', publicContentFingerprint: donationContentVersion(content) });
}
