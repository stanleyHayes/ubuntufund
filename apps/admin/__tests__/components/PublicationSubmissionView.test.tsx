import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubmissionView } from '@/components/publication/SubmissionView'
import { parseSubmission, type PublicationReviewItem } from '@/lib/publicationReview'

const now = Date.parse('2026-09-30T12:00:00.000Z')
const cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/campaigns/cover.jpg'
function view(fields: Partial<PublicationReviewItem> & { action: string; text: string }, campaignReviewGoalGhs?: number) {
  const item: PublicationReviewItem = { id: 'review', actorId: 'author', mediaUrls: [], status: 'pending', reason: 'staff_requested', ...fields }
  return render(<SubmissionView item={item} parsed={parseSubmission(item.action, item.text, item.mediaUrls)} campaignReviewGoalGhs={campaignReviewGoalGhs} now={now} />)
}
const term = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement

const story = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1}. ${'The tablets help children read and speak. '.repeat(4)}`).join('\n\n')
const proposal = {
  title: 'Neurodyne assistive tablets', description: story, category: 'business', priority: 'critical', beneficiaries: ['Neurodyne', 'Accra, Kumasi'],
  goalAmount: 1000000, currency: 'GHS', endDate: '2026-10-31T00:00:00.000Z',
  onBehalf: { beneficiaryName: 'Kwame', beneficiaryType: 'individual', relationship: 'patient', reason: 'He needs a tablet.', payoutArrangement: 'beneficiary', beneficiaryEmail: 'kwame@example.test' },
  extra: 'unexpected',
}

describe('campaign proposal', () => {
  it('shows every field formatted, and every field it does not recognise', () => {
    const { container } = view({ action: 'campaign.create', text: JSON.stringify(proposal), mediaUrls: [cover] }, 250000)
    expect(within(term('Goal')).getByText('GH₵1,000,000')).toBeInTheDocument()
    expect(within(term('Goal')).getByText('Above the GH₵250,000 campaign-review limit')).toBeInTheDocument()
    expect(within(term('End date')).getByText('31 Oct 2026')).toBeInTheDocument()
    expect(within(term('End date')).getByText('in 31 days · UTC date')).toBeInTheDocument()
    expect(within(term('Category')).getByText('Business')).toBeInTheDocument()
    expect(within(term('Priority')).getByText('Critical')).toBeInTheDocument()
    expect(within(term('Relationship')).getByText('Patient')).toBeInTheDocument()
    expect(within(term('Payouts')).getByText('Paid to the beneficiary')).toBeInTheDocument()
    expect(within(term('Beneficiary type')).getByText('Person')).toBeInTheDocument()
    const beneficiaries = within(term('Beneficiaries')).getAllByRole('listitem')
    expect(beneficiaries.map(item => item.textContent)).toEqual(['Neurodyne', 'Accra, Kumasi'])
    expect(screen.getByRole('heading', { name: 'Image' })).toBeInTheDocument()
    expect(screen.getByAltText('Cover image preview')).toHaveAttribute('src', cover)
    expect(screen.getByRole('heading', { name: 'On behalf of someone else' })).toBeInTheDocument()
    expect(screen.getByText('He needs a tablet.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Other submitted fields' })).toBeInTheDocument()
    expect(within(term('On behalf › Beneficiary email')).getByText('kwame@example.test')).toBeInTheDocument()
    expect(within(term('Extra')).getByText('unexpected')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\[object Object\]|undefined|NaN|2026-10-31T/)
  })

  it('clamps a long story behind an expander that keeps the full text in the page', () => {
    view({ action: 'campaign.create', text: JSON.stringify(proposal) })
    const text = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === story)
    const toggle = screen.getByRole('button', { name: /^Show full story \([\d,]+ characters\)$/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', text.id)
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    expect(text.textContent).toBe(story)
  })

  it('renders author markup and links as plain text', () => {
    const { container } = view({ action: 'campaign.create', text: JSON.stringify({ ...proposal, description: '<b>x</b> https://evil.test', title: '<i>Title</i>' }) })
    expect(screen.getByText('<b>x</b> https://evil.test')).toBeInTheDocument()
    expect(container.querySelector('b, i, a')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a dotted top-level key and the nested key it resembles, both', () => {
    view({ action: 'campaign.create', text: JSON.stringify({ ...proposal, 'onBehalf.beneficiaryEmail': 'top-level value' }) })
    expect(screen.getByText('kwame@example.test')).toBeInTheDocument()
    expect(screen.getByText('top-level value')).toBeInTheDocument()
  })

  it('notes the campaign-review limit only when the API sent it', () => {
    view({ action: 'campaign.create', text: JSON.stringify(proposal) })
    expect(screen.queryByText(/campaign-review limit/)).toBeNull()
  })
})

describe('other submissions', () => {
  it('shows profile image states, a website as text and formatted amounts', () => {
    const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/photo.jpg', old = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/old.jpg'
    const { unmount } = view({ action: 'creator.profile', baseVersion: '4', text: JSON.stringify({ handle: 'ama', displayName: 'Ama', tagline: '', tipsEnabled: true, presetAmounts: [10, 25], currency: 'GHS', avatarUrl: photo, coverUrl: old, bio: 'My bio', thankYouMessage: 'Thanks!' }), mediaUrls: [photo] })
    expect(within(term('Profile photo')).getByText('New, shown below')).toBeInTheDocument()
    expect(within(term('Cover image')).getByText('Unchanged (already reviewed)')).toBeInTheDocument()
    expect(within(term('Cover image')).getByText(old)).toBeInTheDocument()
    expect(within(term('Suggested amounts')).getAllByRole('listitem').map(item => item.textContent)).toEqual(['GH₵10', 'GH₵25'])
    expect(within(term('Tips')).getByText('On')).toBeInTheDocument()
    expect(screen.getByAltText('Photo preview')).toHaveAttribute('src', photo)
    unmount()
    view({ action: 'organization.profile', text: JSON.stringify({ organizationName: 'Neurodyne', website: 'https://neurodyne.example' }) })
    expect(within(term('Website')).getByText('https://neurodyne.example')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Changes the public organization name and website.')).toBeInTheDocument()
  })

  it('shows anonymous names and empty messages for supporter and donor content', () => {
    const { unmount } = view({ action: 'tip.public_content', text: JSON.stringify({ supporterName: 'Anonymous', message: '' }) })
    expect(within(term('Public name')).getByText('Anonymous')).toBeInTheDocument()
    expect(screen.getByText('The supporter chose to stay anonymous')).toBeInTheDocument()
    expect(screen.getByText('No message')).toBeInTheDocument()
    unmount()
    view({ action: 'donation.public_content', text: JSON.stringify({ donorName: 'Kofi', message: 'Keep going' }) })
    expect(within(term('Public name')).getByText('Kofi')).toBeInTheDocument()
    expect(screen.getByText('Keep going')).toBeInTheDocument()
  })

  it('falls back to the exact submitted text for a plain comment', () => {
    view({ action: 'comment.create', text: 'A plain comment\n  with spacing' })
    expect(screen.getByRole('heading', { name: 'Submitted text' })).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'A plain comment\n  with spacing')).toBeInTheDocument()
  })

  it('shows a web address change against the address when proposed and the current one', () => {
    view({ action: 'campaign.slug', text: 'new-name', baseVersion: 'old-name', author: null, campaign: { id: 'c', slug: 'other-name' } })
    expect(within(term('Proposed address')).getByText('/c/new-name')).toBeInTheDocument()
    expect(within(term('Address when proposed')).getByText('/c/old-name')).toBeInTheDocument()
    expect(within(term('Current address')).getByText('/c/other-name')).toBeInTheDocument()
    expect(screen.getByText(/The address changed after this was proposed/)).toBeInTheDocument()
  })

  it('lists the values of an array it has no layout for', () => {
    view({ action: 'update.create', text: JSON.stringify(['Only two', 'parts']) })
    expect(screen.getByRole('heading', { name: 'Submitted values' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Only two', 'parts'])
  })
})
