export type ReportReason =
  | 'fraudulent'
  | 'misleading'
  | 'inappropriate_content'
  | 'spam'
  | 'illegal_activity'
  | 'intellectual_property'
  | 'privacy'
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
  /** Staff decision metadata, set once when a pending report is reviewed. */
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
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
