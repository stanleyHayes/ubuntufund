import type {
  ReportRepositoryPort,
  ReportRecord,
} from '../../../../domain/ports/outbound/ReportRepositoryPort.js';
import {
  ReportModel,
  type ReportDocument,
} from '../../../database/models/ReportModel.js';

function toDomain(doc: ReportDocument): ReportRecord {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    reporterId: doc.reporterId,
    reason: doc.reason,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export class MongoReportRepository implements ReportRepositoryPort {
  async save(report: ReportRecord): Promise<ReportRecord> {
    const doc = await ReportModel.create({
      campaignId: report.campaignId,
      reporterId: report.reporterId,
      reason: report.reason,
      description: report.description,
      status: report.status,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<ReportRecord | null> {
    const doc = await ReportModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<ReportRecord[]> {
    const docs = await ReportModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async existsByCampaignAndReporter(
    campaignId: string,
    reporterId: string
  ): Promise<boolean> {
    const count = await ReportModel.countDocuments({
      campaignId,
      reporterId,
    });
    return count > 0;
  }
}
