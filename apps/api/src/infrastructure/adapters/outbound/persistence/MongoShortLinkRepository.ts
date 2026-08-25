import { ShortLinkEntity } from '../../../../domain/entities/ShortLink.js';
import type { ShortLinkRepositoryPort } from '../../../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import {
  ShortLinkModel,
  MAX_RETAINED_SCANS,
  type ShortLinkDocument,
} from '../../../database/models/ShortLinkModel.js';

function toDomain(doc: ShortLinkDocument): ShortLinkEntity {
  return new ShortLinkEntity({
    id: doc._id!.toString(),
    code: doc.code,
    campaignId: doc.campaignId,
    liveSessionId: doc.liveSessionId,
    kind: doc.kind,
    presetAmount: doc.presetAmount,
    label: doc.label,
    createdBy: doc.createdBy,
    target: doc.target,
    scanCount: doc.scanCount,
    scans: doc.scans.map((s) => ({ source: s.source, scannedAt: s.scannedAt })),
    createdAt: doc.createdAt,
  });
}

export class MongoShortLinkRepository implements ShortLinkRepositoryPort {
  async save(shortLink: ShortLinkEntity): Promise<ShortLinkEntity> {
    const plain = shortLink.toPlain();
    const doc = await ShortLinkModel.create({
      code: plain.code,
      campaignId: plain.campaignId,
      liveSessionId: plain.liveSessionId,
      kind: plain.kind,
      presetAmount: plain.presetAmount,
      label: plain.label,
      createdBy: plain.createdBy,
      target: plain.target,
      scanCount: plain.scanCount,
      scans: plain.scans,
    });
    return toDomain(doc);
  }

  async findByCode(code: string): Promise<ShortLinkEntity | null> {
    const doc = await ShortLinkModel.findOne({ code });
    return doc ? toDomain(doc) : null;
  }

  async existsByCode(code: string): Promise<boolean> {
    const doc = await ShortLinkModel.exists({ code });
    return doc !== null;
  }

  async findByCampaignId(campaignId: string): Promise<ShortLinkEntity[]> {
    const docs = await ShortLinkModel.find({ campaignId }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async recordScan(
    code: string,
    source?: string
  ): Promise<ShortLinkEntity | null> {
    const scan = { source, scannedAt: new Date() };
    const doc = await ShortLinkModel.findOneAndUpdate(
      { code },
      {
        $inc: { scanCount: 1 },
        // Append the scan but keep only the most recent MAX_RETAINED_SCANS so
        // the array never grows without bound.
        $push: { scans: { $each: [scan], $slice: -MAX_RETAINED_SCANS } },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
