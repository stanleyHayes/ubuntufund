import type { ProviderRefundMatch, RefundOperation, RefundOperationRepositoryPort, RefundOperationState } from '../../../../domain/ports/outbound/RefundOperationRepositoryPort.js';
import { RefundOperationModel } from '../../../database/models/RefundOperationModel.js';

function domain(doc: Record<string, unknown>): RefundOperation {
  const { _id, __v: _version, ...fields } = doc;
  return { ...fields, id: String(_id) } as unknown as RefundOperation;
}
/** States in which a submitted console refund can still be processed by the provider. */
const PRODUCING_STATES: RefundOperationState[] = ['submitting', 'provider_pending', 'provider_unknown', 'reversal_pending', 'completed'];

export class MongoRefundOperationRepository implements RefundOperationRepositoryPort {
  private readonly ready = RefundOperationModel.init();
  async claimProviderRefund(match: ProviderRefundMatch): Promise<boolean> {
    await this.ready;
    const { transactionReference, amountMinor, providerRefundId, operationId, refundKey } = match;
    // Only console refunds Ujimora submitted; a recorded provider reversal is
    // the external refund itself, never proof that Ujimora requested one.
    const console_ = { transactionReference, origin: { $exists: false } };
    // Exact identity first: the provider's refund id or our merchant note. The
    // match is stamped so the operation cannot also absorb another refund below.
    const identities = [
      ...(providerRefundId ? [{ providerReference: providerRefundId }] : []),
      ...(operationId ? [{ _id: operationId }] : []),
    ];
    for (const identity of identities) {
      const operation = await RefundOperationModel.findOne({ ...console_, ...identity }).lean();
      if (!operation) continue;
      const key = refundKey ?? providerRefundId;
      if (key && !operation.webhookRefundKey) {
        await RefundOperationModel.updateOne({ _id: operation._id, webhookRefundKey: { $exists: false } }, { $set: { webhookRefundKey: key } });
      }
      return true;
    }
    if (!refundKey || amountMinor === undefined) return false;
    // A redelivery of a refund already matched to an operation.
    if (await RefundOperationModel.exists({ ...console_, webhookRefundKey: refundKey })) return true;
    // Otherwise claim ONE unmatched operation of this amount that can still
    // produce a processed refund (a failed one cannot), so a second refund of
    // the same amount — e.g. from the dashboard — is never absorbed by it.
    const claimed = await RefundOperationModel.findOneAndUpdate(
      { ...console_, amountMinor, state: { $in: PRODUCING_STATES }, webhookRefundKey: { $exists: false } },
      { $set: { webhookRefundKey: refundKey } },
      { sort: { createdAt: 1, _id: 1 } }
    );
    return !!claimed;
  }
  async findByRequestKey(intentId: string, requestKey: string) {
    await this.ready;
    const doc = await RefundOperationModel.findOne({ intentId, requestKey }).lean();
    return doc ? domain(doc) : null;
  }
  async findActiveByIntentId(intentId: string) {
    await this.ready;
    const doc = await RefundOperationModel.findOne({ intentId, active: true }).lean();
    return doc ? domain(doc) : null;
  }
  async findById(id: string) {
    const doc = await RefundOperationModel.findById(id).lean();
    return doc ? domain(doc) : null;
  }
  async create(operation: RefundOperation) {
    const { id, ...fields } = operation;
    await RefundOperationModel.create([{ _id: id, ...fields }]);
  }
  async update(id: string, expected: RefundOperationState[], patch: Partial<Pick<RefundOperation, 'state' | 'active' | 'providerReference' | 'issue'>>) {
    const result = await RefundOperationModel.updateOne({ _id: id, state: { $in: expected },
      ...(patch.providerReference ? { $or: [{ providerReference: { $exists: false } }, { providerReference: patch.providerReference }] } : {}),
    }, { $set: patch });
    return result.matchedCount === 1;
  }
  async listUnresolved(page: number, pageSize = 25) {
    await this.ready;
    const [items, total] = await Promise.all([
      RefundOperationModel.find({ active: true }).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      RefundOperationModel.countDocuments({ active: true }),
    ]);
    return { items: items.map(domain), total };
  }
}
