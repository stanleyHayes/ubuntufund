import {
  REFUND_REQUEST_TRANSITIONS,
  type RefundRepositoryPort,
  type RefundRecord,
  type RefundRequestListParams,
  type RefundRequestStatusUpdate,
  type RefundStatus,
} from '../../../../domain/ports/outbound/RefundRepositoryPort.js';
import {
  RefundModel,
  type RefundDocument,
} from '../../../database/models/RefundModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

function toDomain(doc: RefundDocument): RefundRecord {
  return {
    id: doc._id!.toString(),
    donationId: doc.donationId,
    campaignId: doc.campaignId,
    requesterId: doc.requesterId,
    reason: doc.reason,
    description: doc.description,
    amount: doc.amount,
    fee: doc.fee,
    netAmount: doc.netAmount,
    currency: doc.currency,
    status: doc.status,
    staffNote: doc.staffNote,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt,
    refundOperationId: doc.refundOperationId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoRefundRepository implements RefundRepositoryPort {
  async save(refund: RefundRecord): Promise<RefundRecord> {
    const doc = await RefundModel.create({
      donationId: refund.donationId,
      campaignId: refund.campaignId,
      requesterId: refund.requesterId,
      reason: refund.reason,
      description: refund.description,
      amount: refund.amount,
      fee: refund.fee,
      netAmount: refund.netAmount,
      currency: refund.currency,
      status: refund.status,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<RefundRecord | null> {
    const doc = await RefundModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByDonationId(donationId: string): Promise<RefundRecord | null> {
    const doc = await RefundModel.findOne({ donationId });
    return doc ? toDomain(doc) : null;
  }

  async findByRequesterId(requesterId: string): Promise<RefundRecord[]> {
    const docs = await RefundModel.find({ requesterId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async list(
    params: RefundRequestListParams
  ): Promise<{ items: RefundRecord[]; total: number }> {
    const filter = params.status ? { status: params.status } : {};
    const [docs, total] = await Promise.all([
      RefundModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .skip((params.page - 1) * params.pageSize)
        .limit(params.pageSize),
      RefundModel.countDocuments(filter),
    ]);
    return { items: docs.map(toDomain), total };
  }

  async updateStatus(
    id: string,
    update: RefundRequestStatusUpdate
  ): Promise<RefundRecord | null> {
    const from = (Object.keys(REFUND_REQUEST_TRANSITIONS) as RefundStatus[]).filter(
      (status) => REFUND_REQUEST_TRANSITIONS[status].includes(update.status)
    );
    if (!from.length) return null;
    return new MongoUnitOfWork().run(async () => {
      const before = await RefundModel.findOne({ _id: id, status: { $in: from } });
      if (!before) return null;
      // Conditional on the status just read: a concurrent reviewer's change
      // makes this match nothing, so only one transition and audit row win.
      const doc = await RefundModel.findOneAndUpdate(
        { _id: id, status: before.status },
        {
          $set: {
            status: update.status,
            staffNote: update.staffNote,
            reviewedBy: update.actorId,
            reviewedAt: new Date(),
            ...(update.refundOperationId ? { refundOperationId: update.refundOperationId } : {}),
          },
        },
        { new: true }
      );
      if (!doc) return null;
      await AuditLogModel.create({
        actorId: update.actorId,
        actorRole: 'admin',
        action: `refund_request.${update.status}`,
        resource: `refund-request:${id}`,
        details: `Refund request for donation ${doc.donationId} moved from ${before.status} to ${update.status}`,
        reason: update.staffNote,
        changes: [{ field: 'status', before: before.status, after: update.status }],
        severity: update.status === 'completed' || update.status === 'failed' ? 'warning' : 'info',
        method: 'PATCH',
        path: '/admin/refund-requests/:id',
        statusCode: 200,
      });
      return toDomain(doc);
    });
  }
}
