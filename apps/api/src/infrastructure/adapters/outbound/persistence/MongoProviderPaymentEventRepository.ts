import type {
  NewProviderPaymentEvent,
  ProviderPaymentEvent,
  ProviderPaymentEventRepositoryPort,
} from '../../../../domain/ports/outbound/ProviderPaymentEventRepositoryPort.js';
import { ProviderPaymentEventModel } from '../../../database/models/ProviderPaymentEventModel.js';

type Doc = Record<string, unknown> & { _id: { toString(): string }; createdAt: Date };

function toDomain(doc: Doc): ProviderPaymentEvent {
  return {
    id: doc._id.toString(),
    provider: doc.provider as 'paystack',
    event: doc.event as string,
    kind: doc.kind as 'dispute' | 'refund',
    eventKey: doc.eventKey as string,
    reference: doc.reference as string | undefined,
    subject: doc.subject as ProviderPaymentEvent['subject'],
    subjectId: doc.subjectId as string | undefined,
    campaignId: doc.campaignId as string | undefined,
    providerCaseId: doc.providerCaseId as string | undefined,
    amountMinor: doc.amountMinor as number | undefined,
    currency: doc.currency as string | undefined,
    providerStatus: doc.providerStatus as string | undefined,
    providerResolution: doc.providerResolution as string | undefined,
    reviewStatus: doc.reviewStatus as 'open' | 'acknowledged',
    acknowledgedBy: doc.acknowledgedBy as string | undefined,
    acknowledgedAt: doc.acknowledgedAt as Date | undefined,
    createdAt: doc.createdAt,
  };
}

export class MongoProviderPaymentEventRepository implements ProviderPaymentEventRepositoryPort {
  async recordOnce(event: NewProviderPaymentEvent): Promise<{ event: ProviderPaymentEvent; created: boolean }> {
    await ProviderPaymentEventModel.init();
    // Upsert on the unique key: a replayed or concurrent delivery matches the
    // existing row and changes nothing.
    const result = await ProviderPaymentEventModel.findOneAndUpdate(
      { eventKey: event.eventKey },
      { $setOnInsert: { ...event, reviewStatus: 'open' } },
      { upsert: true, new: true, includeResultMetadata: true }
    ).catch(async (error: { code?: number }) => {
      if (error?.code !== 11000) throw error;
      const doc = await ProviderPaymentEventModel.findOne({ eventKey: event.eventKey });
      return { value: doc, lastErrorObject: { updatedExisting: true } };
    });
    const doc = result.value as unknown as Doc;
    return { event: toDomain(doc), created: !result.lastErrorObject?.updatedExisting };
  }

  async list(params: { reviewStatus?: 'open' | 'acknowledged'; limit?: number }): Promise<ProviderPaymentEvent[]> {
    const docs = await ProviderPaymentEventModel.find(params.reviewStatus ? { reviewStatus: params.reviewStatus } : {})
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(params.limit ?? 50, 1), 200))
      .lean();
    return docs.map((doc) => toDomain(doc as unknown as Doc));
  }

  async acknowledge(id: string, adminId: string): Promise<boolean> {
    const result = await ProviderPaymentEventModel.updateOne(
      { _id: id, reviewStatus: 'open' },
      { $set: { reviewStatus: 'acknowledged', acknowledgedBy: adminId, acknowledgedAt: new Date() } }
    );
    return result.matchedCount === 1;
  }
}
