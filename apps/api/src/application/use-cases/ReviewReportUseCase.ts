import type { AdminReportRepositoryPort } from '../../domain/ports/outbound/AdminReportRepositoryPort.js';
import type { ReportRecord } from '../../domain/ports/outbound/ReportRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface ReviewReportInput {
  status: 'reviewed' | 'dismissed';
}

export class ReviewReportUseCase {
  constructor(private readonly reportRepo: AdminReportRepositoryPort) {}

  async execute(
    reportId: string,
    input: ReviewReportInput
  ): Promise<ReportRecord> {
    const existing = await this.reportRepo.findById(reportId);
    if (!existing) {
      throw new AppError('Report not found', 404);
    }

    if (existing.status !== 'pending') {
      throw new AppError('Report has already been reviewed', 409);
    }

    const updated = await this.reportRepo.updateStatus(
      reportId,
      input.status
    );
    if (!updated) {
      throw new AppError('Report not found', 404);
    }

    return updated;
  }
}
