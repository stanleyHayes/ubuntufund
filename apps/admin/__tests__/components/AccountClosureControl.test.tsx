import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post: state.post, get: state.get } }))
import AccountClosureControl from '@/components/AccountClosureControl'

const NOTE = 'Holder emailed from the registered address on 24 Sept.'
const renderControl = (canClose = true) => render(<MemoryRouter initialEntries={['/users/u1']}><Routes>
  <Route path="/users/u1" element={<AccountClosureControl userId="u1" email="ama@example.test" canClose={canClose} />} />
  <Route path="/users" element={<p>User list</p>} />
</Routes></MemoryRouter>)
beforeEach(() => {
  state.post.mockReset().mockResolvedValue({ closed: true })
  state.get.mockReset().mockResolvedValue({ canClose: true, blockers: [], openCampaigns: 0 })
})
afterEach(cleanup)

it('closes only after a verification note and the typed account email', async () => {
  renderControl()
  fireEvent.click(screen.getByRole('button', { name: 'Close account' }))
  const confirm = () => screen.getAllByRole('button', { name: 'Close account' }).at(-1)!
  expect(confirm()).toBeDisabled()
  await waitFor(() => expect(state.get).toHaveBeenCalledWith('/admin/users/u1/closure', expect.anything()))
  fireEvent.change(screen.getByRole('textbox', { name: /How the request was verified/ }), { target: { value: NOTE } })
  fireEvent.change(screen.getByRole('textbox', { name: /Type the account email/ }), { target: { value: 'someone@example.test' } })
  expect(confirm()).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /Type the account email/ }), { target: { value: 'AMA@example.test' } })
  fireEvent.click(confirm())
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/users/u1/close', { verificationNote: NOTE, confirmEmail: 'AMA@example.test' }))
  expect(await screen.findByText('User list')).toBeVisible()
})

it('is unavailable without permission', () => {
  renderControl(false)
  expect(screen.getByRole('button', { name: 'Close account' })).toBeDisabled()
})

it('shows money blockers before closing and never enables the confirm button', async () => {
  const message = 'This account can’t be closed while money is outstanding. The holder must first withdraw or resolve: GHS 150.00 in their Ujimora wallet.'
  state.get.mockResolvedValueOnce({ canClose: false, blockers: [{ kind: 'wallet_balance', currency: 'GHS', amount: 150 }], openCampaigns: 0, message })
  renderControl()
  fireEvent.click(screen.getByRole('button', { name: 'Close account' }))
  expect(await screen.findByText(message)).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: /How the request was verified/ }), { target: { value: NOTE } })
  fireEvent.change(screen.getByRole('textbox', { name: /Type the account email/ }), { target: { value: 'ama@example.test' } })
  expect(screen.getAllByRole('button', { name: 'Close account' }).at(-1)).toBeDisabled()
  expect(state.post).not.toHaveBeenCalled()
})

it('tells staff which open campaigns closing will end', async () => {
  state.get.mockResolvedValueOnce({ canClose: true, blockers: [], openCampaigns: 2 })
  renderControl()
  fireEvent.click(screen.getByRole('button', { name: 'Close account' }))
  expect(await screen.findByText('Closing ends 2 open campaigns.')).toBeVisible()
})
