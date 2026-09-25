import type {
  ReportRepositoryPort,
  ReportRecord,
  ReportStatus,
} from './ReportRepositoryPort.js';

export interface ReportListParams {
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

export interface ReportReviewInput {
  status: Exclude<ReportStatus, 'pending'>;
  /** Staff reasoning, kept on the report and in the audit log. */
  notes: string;
  reviewerId: string;
}

/**
 * Extends the existing ReportRepositoryPort (used by the donor-facing
 * report-a-campaign flow) with the additional operations the moderation
 * console needs: listing across campaigns and transitioning a report's
 * status once it has been reviewed.
 */
export interface AdminReportRepositoryPort extends ReportRepositoryPort {
  findAll(
    params: ReportListParams
  ): Promise<{ items: ReportRecord[]; total: number }>;
  /**
   * Record a staff decision on a still-pending report and write its audit row
   * atomically. Resolves null when the report is missing or was already
   * decided, so two reviewers can never both record a decision. Rejects with
   * 403 when the reviewer filed the report or owns the reported campaign.
   */
  review(id: string, input: ReportReviewInput): Promise<ReportRecord | null>;
}
