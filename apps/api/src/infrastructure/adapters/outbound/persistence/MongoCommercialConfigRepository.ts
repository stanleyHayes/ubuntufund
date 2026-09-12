import type {
  CommercialConfigRepositoryPort,
  CommercialConfigVersion,
} from '../../../../domain/ports/outbound/CommercialConfigRepositoryPort.js';
import {
  CommercialConfigModel,
  type CommercialConfigDocument,
} from '../../../database/models/CommercialConfigModel.js';

function toVersion(doc: CommercialConfigDocument): CommercialConfigVersion {
  return {
    key: doc.key,
    value: doc.value,
    textValue: doc.textValue,
    effectiveFrom: doc.effectiveFrom,
    createdBy: doc.createdBy,
    reason: doc.reason,
    createdAt: doc.createdAt,
  };
}

export class MongoCommercialConfigRepository
  implements CommercialConfigRepositoryPort
{
  async getEffectiveValue(key: string, at: Date): Promise<number | null> {
    // `createdAt` breaks ties on an identical `effectiveFrom` (e.g. two changes
    // scheduled for the same date-only instant) so the LATEST write wins — a
    // correction is never silently masked by the row it replaced.
    const doc = await CommercialConfigModel.findOne({
      key,
      effectiveFrom: { $lte: at },
    }).sort({ effectiveFrom: -1, createdAt: -1 });
    return doc?.value ?? null;
  }

  async getEffectiveMap(keys: string[], at: Date): Promise<Record<string, number>> {
    // Newest-effective row per key at `at`, in one aggregation. The `createdAt`
    // secondary sort makes the newest write win on an identical `effectiveFrom`
    // (see getEffectiveValue).
    const rows = await CommercialConfigModel.aggregate<{ _id: string; value: number }>([
      // Only numeric rows: a text setting has no `value`, and letting one
      // through would surface `undefined` where callers expect a number.
      { $match: { key: { $in: keys }, effectiveFrom: { $lte: at }, value: { $ne: null } } },
      { $sort: { effectiveFrom: -1, createdAt: -1 } },
      { $group: { _id: '$key', value: { $first: '$value' } } },
    ]);
    const map: Record<string, number> = {};
    for (const r of rows) map[r._id] = r.value;
    return map;
  }

  async setValue(input: {
    key: string;
    value: number;
    effectiveFrom: Date;
    createdBy: string;
    reason?: string;
  }): Promise<CommercialConfigVersion> {
    const doc = await CommercialConfigModel.create(input);
    return toVersion(doc);
  }

  async getEffectiveText(key: string, at: Date): Promise<string | null> {
    // Same newest-wins ordering as the numeric read.
    const doc = await CommercialConfigModel.findOne({
      key,
      effectiveFrom: { $lte: at },
    }).sort({ effectiveFrom: -1, createdAt: -1 });
    return doc?.textValue ?? null;
  }

  async setText(input: {
    key: string;
    textValue: string;
    effectiveFrom: Date;
    createdBy: string;
    reason?: string;
  }): Promise<CommercialConfigVersion> {
    const doc = await CommercialConfigModel.create(input);
    return toVersion(doc);
  }

  async history(key: string): Promise<CommercialConfigVersion[]> {
    const docs = await CommercialConfigModel.find({ key }).sort({ effectiveFrom: -1, createdAt: -1 });
    return docs.map(toVersion);
  }
}
