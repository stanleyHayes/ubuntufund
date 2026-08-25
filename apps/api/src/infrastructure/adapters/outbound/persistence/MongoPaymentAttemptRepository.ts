import type { PaymentAttempt } from '@ubuntu-fund/types';
import type {
  PaymentAttemptRepositoryPort,
  RecordPaymentAttemptInput,
} from '../../../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import {
  PaymentAttemptModel,
  type PaymentAttemptDocument,
} from '../../../database/models/PaymentAttemptModel.js';

function toDomain(doc: PaymentAttemptDocument): PaymentAttempt {
  return {
    id: doc._id!.toString(),
    intentId: doc.intentId,
    provider: doc.provider,
    providerRef: doc.providerRef,
    status: doc.status,
    raw: doc.raw,
    createdAt: doc.createdAt,
  };
}

export class MongoPaymentAttemptRepository
  implements PaymentAttemptRepositoryPort
{
  async record(input: RecordPaymentAttemptInput): Promise<PaymentAttempt> {
    const doc = await PaymentAttemptModel.create({
      intentId: input.intentId,
      provider: input.provider,
      providerRef: input.providerRef,
      status: input.status,
      raw: input.raw,
    });
    return toDomain(doc);
  }

  async findByIntentId(intentId: string): Promise<PaymentAttempt[]> {
    const docs = await PaymentAttemptModel.find({ intentId }).sort({
      createdAt: 1,
    });
    return docs.map(toDomain);
  }
}
