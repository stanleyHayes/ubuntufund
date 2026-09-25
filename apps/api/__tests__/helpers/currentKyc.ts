import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';

/**
 * Give an account the current, approved identity (or organization business)
 * verification that every money-out rail now requires: a verified email, the
 * matching stored level and a newest approval with a future expiry.
 */
export async function grantCurrentKyc(
  userId: string,
  options: { organization?: boolean; expiryDate?: Date } = {},
): Promise<void> {
  const organization = options.organization ?? false;
  await UserModel.updateOne(
    { _id: userId },
    { $set: { emailVerified: true }, $max: { verificationLevel: organization ? 3 : 2 } },
  );
  await KYCVerificationModel.create({
    userId,
    verificationType: organization ? 'business' : 'identity',
    status: 'approved',
    documents: [],
    riskLevel: 'low',
    retryCount: 0,
    reviewedAt: new Date(),
    expiryDate: options.expiryDate ?? new Date(Date.now() + 365 * 86_400_000),
  });
}
