import type { AdminReportRepositoryPort } from '../../domain/ports/outbound/AdminReportRepositoryPort.js';
import type { ReportRecord } from '../../domain/ports/outbound/ReportRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { StaffDecisionNotifierPort } from '../../domain/ports/outbound/StaffDecisionNotifierPort.js';

/** Staff must explain every decision; the note is kept on the report and audit log. */
export const REPORT_REVIEW_NOTE_MIN = 20;

export interface ReviewReportInput {
  status: 'reviewed' | 'dismissed';
  notes: string;
}

export class ReviewReportUseCase {
  constructor(
    private readonly reportRepo: AdminReportRepositoryPort,
    private readonly notifier?: StaffDecisionNotifierPort
  ) {}

  async execute(
    reportId: string,
    input: ReviewReportInput,
    reviewerId: string
  ): Promise<ReportRecord> {
    const notes = input.notes.trim();
    if (notes.length < REPORT_REVIEW_NOTE_MIN) {
      throw new AppError(
        `Enter at least ${REPORT_REVIEW_NOTE_MIN} characters of review notes`,
        400
      );
    }

    const existing = await this.reportRepo.findById(reportId);
    if (!existing) {
      throw new AppError('Report not found', 404);
    }

    if (existing.status !== 'pending') {
      throw new AppError('Report has already been reviewed', 409);
    }

    const updated = await this.reportRepo.review(reportId, {
      status: input.status,
      notes,
      reviewerId,
    });
    if (!updated) {
      // Decided by another reviewer between the read and the conditional write.
      throw new AppError('Report has already been reviewed', 409);
    }

    // Neutral acknowledgement for the reporter. The review is already saved, so
    // a failed notice must not fail it; the stable key prevents duplicates.
    await this.notifier?.notify({
      key: `campaign-report:${updated.id}:reporter`,
      userId: updated.reporterId,
      title: 'We reviewed your report',
      body: 'Thank you for reporting this campaign. Our team has reviewed it and taken the action it considers appropriate.',
      path: `/campaigns/${updated.campaignId}`,
    }).catch(() => undefined);

    return updated;
  }
}
