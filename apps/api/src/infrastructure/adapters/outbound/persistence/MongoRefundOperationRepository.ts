import type { RefundOperation, RefundOperationRepositoryPort, RefundOperationState } from '../../../../domain/ports/outbound/RefundOperationRepositoryPort.js';
import { RefundOperationModel } from '../../../database/models/RefundOperationModel.js';

function domain(doc: Record<string, unknown>): RefundOperation {
  const { _id, __v: _version, ...fields } = doc;
  return { ...fields, id: String(_id) } as unknown as RefundOperation;
}
export class MongoRefundOperationRepository implements RefundOperationRepositoryPort {
  private readonly ready = RefundOperationModel.init();
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
