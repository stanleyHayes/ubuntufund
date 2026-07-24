export type ReportReason =
  | 'fraudulent'
  | 'misleading'
  | 'inappropriate_content'
  | 'spam'
  | 'illegal_activity'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface ReportRecord {
  id: string;
  campaignId: string;
  reporterId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: Date;
}

export interface ReportRepositoryPort {
  save(report: ReportRecord): Promise<ReportRecord>;
  findById(id: string): Promise<ReportRecord | null>;
  findByCampaignId(campaignId: string): Promise<ReportRecord[]>;
  existsByCampaignAndReporter(
    campaignId: string,
    reporterId: string
  ): Promise<boolean>;
}
