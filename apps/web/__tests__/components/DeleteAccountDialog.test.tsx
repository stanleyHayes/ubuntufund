import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'

const { get, del } = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, delete: del } }))

const clear = { canClose: true, openCampaigns: 0, blockers: [] }
function respond(closure: unknown, mfa: unknown = { enabled: false }) {
  get.mockImplementation(async (path: string) => path === '/auth/mfa' ? mfa : closure)
}
beforeEach(() => { get.mockReset(); del.mockReset() })

function show() {
  const onDeleted = vi.fn(), onClose = vi.fn()
  render(<DeleteAccountDialog open onClose={onClose} onDeleted={onDeleted} />)
  return { onDeleted, onClose }
}

it('warns about store subscriptions and requires the current password before deleting once', async () => {
  respond(clear)
  let finish!: () => void
  del.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const { onDeleted } = show()
  expect(screen.getByText(/App Store or Google Play subscription is not cancelled automatically/)).toBeInTheDocument()
  const password = await screen.findByLabelText(/Current password/)
  const confirm = screen.getByRole('button', { name: 'Delete my account' })
  expect(confirm).toBeDisabled()
  fireEvent.change(password, { target: { value: 'SecurePass123' } })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(del).toHaveBeenCalledTimes(1)
  expect(del).toHaveBeenCalledWith('/profile', { password: 'SecurePass123' })
  finish()
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
})

it('explains outstanding money and does not offer deletion', async () => {
  const message = 'Your account can’t be closed yet. First withdraw or resolve: GHS 150.00 in your Ujimora wallet.'
  respond({ canClose: false, openCampaigns: 1, message, blockers: [{ kind: 'wallet_balance', currency: 'GHS', amount: 150 }] })
  show()
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled()
  expect(del).not.toHaveBeenCalled()
})

it('warns that open campaigns will end and asks for an MFA code when enabled', async () => {
  respond({ ...clear, openCampaigns: 2 }, { enabled: true })
  del.mockResolvedValue(null)
  const { onDeleted } = show()
  expect(await screen.findByText(/ends your 2 open campaigns/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'SecurePass123' } })
  const confirm = screen.getByRole('button', { name: 'Delete my account' })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/Authenticator or recovery code/), { target: { value: ' 123456 ' } })
  fireEvent.click(confirm)
  await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  expect(del).toHaveBeenCalledWith('/profile', { password: 'SecurePass123', code: '123456' })
})

it('shows why a delete was refused and refreshes the reasons when money appeared meanwhile', async () => {
  const message = 'Your account can’t be closed yet. First withdraw or resolve: 1 payout still being processed.'
  respond(clear)
  del.mockRejectedValueOnce(Object.assign(new Error('Current password is incorrect.'), { status: 400 }))
  const { onDeleted } = show()
  fireEvent.change(await screen.findByLabelText(/Current password/), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  respond({ canClose: false, openCampaigns: 0, message, blockers: [{ kind: 'pending_payout', count: 1 }] })
  del.mockRejectedValueOnce(Object.assign(new Error(message), { status: 409 }))
  fireEvent.change(screen.getByLabelText(/Current password/), { target: { value: 'SecurePass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument())
  expect(screen.getAllByText(message)).toHaveLength(1)
  expect(onDeleted).not.toHaveBeenCalled()
})
