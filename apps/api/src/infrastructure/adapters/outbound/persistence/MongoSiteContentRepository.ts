import type {
  SiteContentRepositoryPort,
  SiteContentRecord,
} from '../../../../domain/ports/outbound/SiteContentRepositoryPort.js';
import {
  SiteContentModel,
  type SiteContentDocument,
} from '../../../database/models/SiteContentModel.js';

function toDomain(doc: SiteContentDocument): SiteContentRecord {
  return {
    key: doc.key,
    type: doc.type,
    data: doc.data,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy ?? undefined,
  };
}

export class MongoSiteContentRepository implements SiteContentRepositoryPort {
  async getByKey(key: string): Promise<SiteContentRecord | null> {
    const doc = await SiteContentModel.findOne({ key });
    return doc ? toDomain(doc) : null;
  }

  async list(): Promise<SiteContentRecord[]> {
    const docs = await SiteContentModel.find().sort({ key: 1 });
    return docs.map(toDomain);
  }

  async upsert(
    key: string,
    type: string,
    data: unknown,
    updatedBy?: string
  ): Promise<SiteContentRecord> {
    // `$set` at the document level replaces `data` wholesale (Mixed fields need
    // no markModified when written through an atomic update). `timestamps`
    // stamps `updatedAt` automatically. Undefined `updatedBy` is stripped by
    // Mongoose so a public/system write never clobbers an existing editor.
    const doc = await SiteContentModel.findOneAndUpdate(
      { key },
      { $set: { type, data, updatedBy } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // With `upsert: true` + `new: true` the query always resolves to the
    // (possibly newly-created) document, never null.
    return toDomain(doc!);
  }

  async count(): Promise<number> {
    return SiteContentModel.estimatedDocumentCount();
  }
}
