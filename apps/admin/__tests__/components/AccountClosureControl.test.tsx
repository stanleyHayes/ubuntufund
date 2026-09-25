import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post: state.post } }))
import AccountClosureControl from '@/components/AccountClosureControl'

const NOTE = 'Holder emailed from the registered address on 24 Sept.'
const renderControl = (canClose = true) => render(<MemoryRouter initialEntries={['/users/u1']}><Routes>
  <Route path="/users/u1" element={<AccountClosureControl userId="u1" email="ama@example.test" canClose={canClose} />} />
  <Route path="/users" element={<p>User list</p>} />
</Routes></MemoryRouter>)
beforeEach(() => state.post.mockReset().mockResolvedValue({ closed: true }))
afterEach(cleanup)

it('closes only after a verification note and the typed account email', async () => {
  renderControl()
  fireEvent.click(screen.getByRole('button', { name: 'Close account' }))
  const confirm = () => screen.getAllByRole('button', { name: 'Close account' }).at(-1)!
  expect(confirm()).toBeDisabled()
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
