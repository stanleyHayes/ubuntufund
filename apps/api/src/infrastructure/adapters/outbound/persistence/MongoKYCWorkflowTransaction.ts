import { lockPrivateKycDocuments } from './lockPrivateKycDocuments.js';
import { kycReviewVersion } from '../../../../application/services/kycReviewVersion.js';
import { toKYCRecord } from './MongoKYCRepository.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { KYCVerificationModel } from '../../../database/models/KYCVerificationModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** Enlist the existing review and account repositories in one fenced decision. */
export class MongoKYCWorkflowTransaction {
  async submit<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      // Serialize active-submission checks with other submissions and closure.
      const applicant = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null, ...(authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }) }, { $inc: { publicationWriteVersion: 1 } });
      if (!applicant) throw new AppError('Your account session has ended.', 401);
      return work();
    });
  }

  async run<T>(id: string, adminId: string, authVersion: string, decision: 'approved' | 'rejected' | 'information_requested', reviewVersion: string | undefined, work: () => Promise<T>): Promise<T> {
    if (!reviewVersion) throw new AppError('Refresh the verification queue before saving a review.', 428);
    return new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.findOneAndUpdate({ _id: adminId, role: 'admin', deletedAt: null, ...(authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }) }, { $inc: { publicationWriteVersion: 1 } });
      if (!staff) throw new AppError('Your administrator session has ended.', 401);
      const record = await KYCVerificationModel.findById(id);
      if (!record) throw new AppError('KYC verification not found', 404);
      if (kycReviewVersion(toKYCRecord(record)) !== reviewVersion) throw new AppError('This application has changed. Refresh the queue and review the latest evidence before saving.', 409);
      if (record.userId === adminId) throw new AppError('Another administrator must review your verification.', 403);
      if (!['pending', 'in_review'].includes(record.status)) throw new AppError('This verification already has a decision.', 409);
      if (decision === 'approved' && record.informationRequests?.some(item => !item.respondedAt)) throw new AppError('Wait for the applicant to respond to the information request.', 409);
      const applicant = await UserModel.findOneAndUpdate({ _id: record.userId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } });
      if (!applicant) throw new AppError('Applicant account is unavailable.', 409);
      if (decision === 'approved') await lockPrivateKycDocuments(record.userId, record.documents);
      const result = await work();
      await AuditLogModel.create({ actorId: adminId, actorRole: 'admin', action: `kyc.${decision}`, resource: id, details: `KYC ${record.verificationType} decision; reviewed version ${reviewVersion}${decision === 'approved' ? '; staff attested evidence review' : ''}`, method: 'PUT', path: `/kyc/:id/${decision === 'approved' ? 'approve' : decision === 'rejected' ? 'reject' : 'request-info'}`, statusCode: 200 });
      return result;
    });
  }
}
