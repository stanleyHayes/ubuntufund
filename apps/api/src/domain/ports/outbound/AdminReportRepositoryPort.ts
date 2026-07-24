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
  updateStatus(id: string, status: ReportStatus): Promise<ReportRecord | null>;
}
