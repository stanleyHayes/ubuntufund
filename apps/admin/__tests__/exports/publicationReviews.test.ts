import { expect, it } from 'vitest'
import { publicationReviewColumns } from '@/lib/exports/publicationReviews'
import { exportTable } from '@/lib/exports/report'
import type { PublicationReviewItem } from '@/lib/publicationReview'

const now = Date.parse('2026-09-30T12:00:00.000Z')
const base = { actorId: 'author', mediaUrls: [], reason: 'staff_requested' }
const items: PublicationReviewItem[] = [
  { ...base, id: 'waiting', action: 'comment.create', text: '{"comment":"Hi"}', status: 'pending', publishOnApproval: true },
  { ...base, id: 'published', action: 'update.create', text: '["Title","Body","general"]', status: 'approved', reviewNotes: 'Checked the update.', publishOnApproval: true, publication: { state: 'published', at: '2026-09-30T10:00:00.000Z', via: 'approval', attempts: 1 } },
  { ...base, id: 'refused', action: 'creator.profile', text: '{"handle":"ama"}', status: 'approved', publishOnApproval: true, publication: { state: 'not_published', reason: 'handle_taken' } },
  { ...base, id: 'declined', action: 'comment.create', text: '{"comment":"No"}', status: 'rejected' },
]

it('adds a last Publication column to the publication queue export, keeping the columns before it in place', () => {
  const table = exportTable('Publication reviews', items, publicationReviewColumns('publication', now))
  expect(table.columns.map(column => column.label)).toEqual(['ID', 'Action', 'Author', 'Status', 'Reason', 'Text', 'Notes', 'Publication'])
  expect(table.rows.map(row => [row[0], row[7]])).toEqual([
    ['waiting', 'Publishes on approval'],
    ['published', 'Published 30 Sept 2026, 10:00 UTC · by approval'],
    ['refused', 'Not published: another creator has the handle now'],
    ['declined', ''],
  ])
  expect(table.rows[1][5]).toBe('Title\n\nBody\n\nUpdate type: general')
})

it('leaves the column out of the supporter and donor content exports, which publish nothing by approval', () => {
  const tip: PublicationReviewItem = { ...base, id: 'tip', action: 'tip.public_content', text: '{"supporterName":"Ama","message":"For you"}', status: 'pending' }
  expect(exportTable('Publication reviews', [tip], publicationReviewColumns('content', now)).columns.map(column => column.label)).toEqual(['ID', 'Action', 'Author', 'Status', 'Reason', 'Text', 'Notes'])
})
