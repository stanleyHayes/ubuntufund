import type {
  NewsletterSubscriptionRepositoryPort,
  NewsletterSubscriptionRecord,
} from '../../../../domain/ports/outbound/NewsletterSubscriptionRepositoryPort.js';
import {
  NewsletterSubscriptionModel,
  type NewsletterSubscriptionDocument,
} from '../../../database/models/NewsletterSubscriptionModel.js';

function toDomain(
  doc: NewsletterSubscriptionDocument
): NewsletterSubscriptionRecord {
  return {
    id: doc._id!.toString(),
    email: doc.email,
    createdAt: doc.createdAt,
  };
}

export class MongoNewsletterSubscriptionRepository
  implements NewsletterSubscriptionRepositoryPort
{
  async upsertByEmail(email: string): Promise<NewsletterSubscriptionRecord> {
    // `email` comes from the filter (set on insert by MongoDB); `createdAt` is
    // stamped only when a new document is inserted. Re-subscribing therefore
    // resolves to the existing, unchanged record.
    const doc = await NewsletterSubscriptionModel.findOneAndUpdate(
      { email },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
    // With `upsert: true` and `new: true` the query always resolves to the
    // (possibly newly-created) document, never null.
    return toDomain(doc!);
  }

  async listAll(): Promise<NewsletterSubscriptionRecord[]> {
    // Newest-first so the admin console surfaces the most recent signups at the
    // top of the list.
    const docs = await NewsletterSubscriptionModel.find().sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }
}
