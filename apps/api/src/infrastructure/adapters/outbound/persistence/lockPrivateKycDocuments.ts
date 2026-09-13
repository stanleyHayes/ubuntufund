import { PrivateKycDocumentModel } from '../../../database/models/PrivateKycDocumentModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** Call inside the KYC transaction so document withdrawal cannot race a decision. */
export async function lockPrivateKycDocuments(userId: string, documents: Array<{ url: string }>): Promise<void> {
  const ids = documents.map(document => {
    const id = /^kyc:\/\/([a-f0-9]{24})$/i.exec(document.url)?.[1];
    if (!id) throw new AppError('A verification document needs a current private upload before this application can proceed.', 422);
    return id.toLowerCase();
  });
  for (const id of [...new Set(ids)].sort()) {
    const result = await PrivateKycDocumentModel.updateOne({ _id: id, userId, deletedAt: { $exists: false } }, { $inc: { reviewWriteVersion: 1 } });
    if (result.matchedCount !== 1) throw new AppError('A verification document is unavailable or belongs to another account. Request a new private upload.', 422);
  }
}
