import { kycReviewVersion } from '../../src/application/services/kycReviewVersion.js';
import { MongoKYCRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoKYCRepository.js';
export async function reviewVersion(id: string): Promise<string> {
  const record = await new MongoKYCRepository().findById(id);
  if (!record) throw new Error('Missing KYC fixture');
  return kycReviewVersion(record);
}
