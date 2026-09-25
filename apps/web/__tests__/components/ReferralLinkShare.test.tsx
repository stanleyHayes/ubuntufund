import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ReferralHowItWorks, ReferralShareShortcuts, referralShareLinks } from '@/components/affiliate/ReferralLinkShare'

afterEach(cleanup)

const link = 'https://ujimora.test/register?ref=ama-k'

it('builds share URLs that carry the encoded referral link and app code', () => {
  const byName = Object.fromEntries(referralShareLinks(link, 'ama-k').map((l) => [l.name, l.href]))
  expect(byName.WhatsApp).toBe(
    `https://wa.me/?text=${encodeURIComponent(`Join me on Ujimora: ${link}\nSigning up in the Ujimora app? Enter referral code ama-k.`)}`,
  )
  expect(byName.X).toContain(`&url=${encodeURIComponent(link)}`)
  expect(byName.Facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)
  expect(byName.Email).toMatch(/^mailto:\?subject=Join%20me%20on%20Ujimora&body=/)
  expect(decodeURIComponent(byName.Email.split('body=')[1])).toContain(link)
})

it('opens web shares in a new tab and email in place', () => {
  render(<ReferralShareShortcuts link={link} code="ama-k" />)
  for (const name of ['WhatsApp', 'X', 'Facebook']) {
    const a = screen.getByRole('link', { name: `Share your referral link via ${name}` })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  }
  const email = screen.getByRole('link', { name: 'Share your referral link via Email' })
  expect(email).not.toHaveAttribute('target')
})

it('explains the program with the affiliate’s own code', () => {
  render(<ReferralHowItWorks code="ama-k" />)
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByText(/enter code ama-k/)).toBeInTheDocument()
})
