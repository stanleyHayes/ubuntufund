import { webcrypto } from 'node:crypto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { CreatorTipPage } from '@/pages/CreatorTipPage'
import { api, ApiError } from '@/lib/api'
import { tipAttemptKey, rememberTipReference } from '@/lib/tipCheckout'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

const storage: Record<string, unknown> = {}
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
  Object.defineProperties(storage, {
    getItem: { configurable: true, value: (key: string) => storage[key] ?? null },
    setItem: { configurable: true, value: (key: string, value: string) => { storage[key] = value } },
    removeItem: { configurable: true, value: (key: string) => { delete storage[key] } },
  })
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('crypto', webcrypto)
  vi.mocked(api.get).mockResolvedValue({ displayName: 'Ama', handle: 'ama', tipsEnabled: true, presetAmounts: [10], currency: 'GHS', supporterCount: 0, totalReceived: 0, recentTips: [] })
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } })
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

const conflict = () => new (ApiError as unknown as new (status: number, message: string) => Error)(409, 'This checkout request key was already used for different details.')
function show() {
  render(<MemoryRouter initialEntries={['/creators/ama']}><Routes><Route path="/creators/:handle" element={<CreatorTipPage />} /></Routes></MemoryRouter>)
}
async function submit() {
  fireEvent.change(await screen.findByLabelText('Email address', { exact: false }), { target: { value: 'fan@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /^Support GH/ }))
}

// I043: after an abandoned checkout, changing the amount returned a dead-end 409.
describe('tip checkout after an earlier attempt with other details', () => {
  it('starts a new checkout automatically when the earlier payment failed', async () => {
    const oldKey = await tipAttemptKey(undefined, 'ama')
    rememberTipReference(oldKey, 'tip-old')
    vi.mocked(api.post).mockImplementation(async (path: string, _body: unknown, headers?: Record<string, string>) => {
      if (path === '/creators/tips/verify') return { status: 'FAILED' }
      if (headers?.['Idempotency-Key'] === oldKey) throw conflict()
      return { checkoutUrl: 'https://checkout.paystack.com/new', reference: 'tip-new' }
    })
    show()
    await submit()
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/new'))
    const keys = vi.mocked(api.post).mock.calls.filter(([path]) => path === '/creators/ama/tips').map(([, , headers]) => (headers as Record<string, string>)['Idempotency-Key'])
    expect(keys).toHaveLength(2)
    expect(keys[1]).not.toBe(oldKey)
  })

  it('asks before paying again while the earlier payment is still open', async () => {
    const oldKey = await tipAttemptKey(undefined, 'ama')
    rememberTipReference(oldKey, 'tip-open')
    vi.mocked(api.post).mockImplementation(async (path: string, _body: unknown, headers?: Record<string, string>) => {
      if (path === '/creators/tips/verify') return { status: 'PENDING' }
      if (headers?.['Idempotency-Key'] === oldKey) throw conflict()
      return { checkoutUrl: 'https://checkout.paystack.com/new', reference: 'tip-new' }
    })
    show()
    await submit()
    expect(await screen.findByText(/unfinished payment for this creator/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check the earlier payment' })).toHaveAttribute('href', '/tip/callback?reference=tip-open')
    expect(window.location.href).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Start a new payment' }))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/new'))
  })

  it('tells the supporter when the earlier tip already went through', async () => {
    const oldKey = await tipAttemptKey(undefined, 'ama')
    rememberTipReference(oldKey, 'tip-paid')
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === '/creators/tips/verify') return { status: 'SUCCEEDED' }
      throw conflict()
    })
    show()
    await submit()
    expect(await screen.findByText(/previous tip to this creator went through/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send another tip' })).toBeInTheDocument()
  })
})
