vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get } }))
import AuditLogPage from '@/pages/AuditLogPage'

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

it('opens pre-filtered when another page links to it with a search', async () => {
  get.mockResolvedValue({ items: [], total: 0 })
  window.history.replaceState({}, '', '/audit?search=campaign-1')
  render(<AuditLogPage />)
  expect(screen.getByRole('textbox', { name: 'Search audit log' })).toHaveValue('campaign-1')
  await waitFor(() => expect(get).toHaveBeenCalledWith('/audit?page=1&pageSize=10&search=campaign-1'))
})
