import { expect, it } from 'vitest'
import { CAMPAIGN_SCREENING_NOTE, QUEUED_COLLABORATOR_INVITES, createdCampaignSummary, pendingReviewMessage } from '../campaignReview'

it('says a campaign held for a content check is saved, private and waiting for a person on the team', () => {
  expect(createdCampaignSummary({ status: 'pending_review', contentReviewReason: 'new_media' })).toEqual({
    title: 'Saved · Pending review',
    message: 'Your campaign is saved and goes live after our team reviews it. A person on our team checks new photos and videos before they go public. Until then it stays private and cannot take donations. We will notify you when it has been reviewed.',
  })
})

it.each([
  ['no_screening_consent', /You chose not to use automated screening/],
  ['screening_flagged', /Our automated check asked for a person/],
  ['screening_unavailable', /Our automated check was not available/],
] as const)('explains the %s reason without promising a review time', (reason, text) => {
  const message = pendingReviewMessage(reason)
  expect(message).toMatch(/^Your campaign is saved and goes live after our team reviews it\./)
  expect(message).toMatch(text)
  expect(message).not.toMatch(/\b(hours?|days?|minutes?|soon|shortly)\b/i)
})

it('keeps the live and general review messages, never a raw status for these outcomes', () => {
  expect(createdCampaignSummary({ status: 'active' })).toEqual({ title: 'Your campaign is live', message: 'Share it with your community.' })
  expect(createdCampaignSummary({ status: 'pending_review' })).toEqual({ title: 'Campaign created', message: 'Your campaign is awaiting review. You can share it once it is live.' })
  // A reason this build does not know yet still reads as saved and waiting.
  expect(pendingReviewMessage('a_future_reason')).toBe('Your campaign is saved and goes live after our team reviews it. Until then it stays private and cannot take donations. We will notify you when it has been reviewed.')
})

it('tells the organizer before publishing what goes to a person', () => {
  expect(CAMPAIGN_SCREENING_NOTE).toMatch(/new photos or video/)
  expect(CAMPAIGN_SCREENING_NOTE).toMatch(/saved as Pending review/)
  expect(CAMPAIGN_SCREENING_NOTE).not.toMatch(/Publication reviews/)
})

it('says collaborator invitations to a campaign waiting for its check are saved, not sent', () => {
  expect(QUEUED_COLLABORATOR_INVITES).toMatch(/saved and will be sent once our team has checked the campaign/)
})
