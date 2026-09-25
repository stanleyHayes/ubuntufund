import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SplitDisclosure, splitDisclosureText } from '@/components/campaigns/SplitDisclosure'
import { api } from '@/lib/api'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
const disclosure = { campaignId: 'c1', version: 1, locked: true, beneficiaries: [
  { name: 'Ama', shareBps: 6000, sharePercent: 60, consent: 'accepted' },
  { name: 'Kofi', shareBps: 3333, sharePercent: 33.33, consent: 'accepted' },
  { name: 'Esi', shareBps: 667, sharePercent: 6.67, consent: 'accepted' },
] }
beforeEach(() => { vi.mocked(api.get).mockReset() })

it('tells donors, before they give, who shares the proceeds and in what proportion', async () => {
  vi.mocked(api.get).mockResolvedValue(disclosure)
  render(<SplitDisclosure campaignId="c1" />)
  expect(await screen.findByText("This campaign's proceeds are shared: Ama 60%, Kofi 33.33%, Esi 6.67%.")).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/campaigns/c1/split')
})

it('renders nothing without an active split or when the disclosure cannot be read', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(null)
  const first = render(<SplitDisclosure campaignId="none" />)
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  expect(first.container).toBeEmptyDOMElement()
  first.unmount()
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Campaign not found'))
  const second = render(<SplitDisclosure campaignId="hidden" />)
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  expect(second.container).toBeEmptyDOMElement()
})

it('formats shares from basis points', () => {
  expect(splitDisclosureText({ ...disclosure, beneficiaries: [disclosure.beneficiaries[0]] } as never)).toBe("This campaign's proceeds are shared: Ama 60%.")
})
