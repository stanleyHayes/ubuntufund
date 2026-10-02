import { exportText, type PublicationReviewItem, type ReviewQueue } from '@/lib/publicationReview'
import { publicationExportText } from '@/lib/reviewGuidance'
import type { ExportCell } from './report'

/**
 * The review export's columns. The publication queue adds Publication: what
 * approving does, or where an approved version stands. It comes last, so the
 * columns before it keep their places in existing spreadsheets.
 */
export function publicationReviewColumns(queue: ReviewQueue, exportedAt: number): Record<string, (item: PublicationReviewItem) => ExportCell> {
  return {
    ID: item => item.id,
    Action: item => item.action,
    Author: item => item.actorId,
    Status: item => item.status,
    Reason: item => item.reason,
    Text: item => exportText(item.action, item.text),
    Notes: item => item.reviewNotes,
    ...(queue === 'publication' ? { Publication: (item: PublicationReviewItem) => publicationExportText(item, exportedAt) } : {}),
  }
}
