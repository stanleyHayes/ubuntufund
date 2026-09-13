import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NewsletterSignup } from '../src/components/NewsletterSignup'
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: { message: 'Confirmation requested' } }), { headers: { 'Content-Type': 'application/json' } })); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())
function show() { render(<MemoryRouter><NewsletterSignup /></MemoryRouter>) }
it('requires a separate unchecked choice and reports confirmation rather than immediate subscription', async () => {
  show()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /Newsletter email address/ }), { target: { value: 'reader@example.test' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
  expect(await screen.findByRole('status')).toHaveTextContent('No newsletters will be sent until you confirm')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'reader@example.test', consent: true })
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})
it('keeps a delivery outage visible without claiming a successful subscription', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 503 }))
  show()
  fireEvent.change(screen.getByRole('textbox', { name: /Newsletter email address/ }), { target: { value: 'reader@example.test' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not request')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
