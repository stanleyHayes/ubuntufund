import { Blob as NodeBlob } from 'node:buffer'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ExportMenu from '@/components/ExportMenu'
import { api } from '@/lib/api'
import type { ExportReport } from '@/lib/exports/report'
const state = vi.hoisted(() => ({ user: { id: 'admin' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/lib/session', () => ({ browserSession: { accessToken: () => state.user ? 'token' : null } }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
const report: ExportReport = { title: 'Users', generatedAt: new Date('2026-09-12T00:00:00Z'), tables: [{ title: 'Users', columns: [{ label: 'Name' }], rows: [['=Unsafe'], ['Ama']] }] }
let createUrl: ReturnType<typeof vi.fn<(blob: Blob | MediaSource) => string>>
beforeEach(() => {
  state.user = { id: 'admin' }
  vi.mocked(api.get).mockReset().mockResolvedValue({ id: 'admin' })
  vi.stubGlobal('Blob', NodeBlob)
  createUrl = vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:test-export')
  vi.stubGlobal('URL', class extends URL { static createObjectURL = createUrl; static revokeObjectURL = vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function csv() { fireEvent.click(screen.getByRole('button', { name: 'Export Users' })); fireEvent.click(await screen.findByRole('menuitem', { name: 'CSV (.csv)' })) }
it('authorizes before collection and before the actual download, producing a safe CSV', async () => {
  render(<MemoryRouter><ExportMenu title="Users" getReport={() => report} /></MemoryRouter>)
  await csv()
  await screen.findByText('CSV download ready.')
  expect(api.get).toHaveBeenCalledTimes(2)
  expect(api.get).toHaveBeenCalledWith('/users/admin', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  expect(await (createUrl.mock.calls[0][0] as Blob).text()).toContain('"\'=Unsafe"')
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
})
it('withholds the file if authorization is revoked during generation', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ id: 'admin' }).mockRejectedValueOnce(new Error('Permission denied'))
  render(<MemoryRouter><ExportMenu title="Users" getReport={() => report} /></MemoryRouter>)
  await csv()
  await screen.findByText('Permission denied')
  expect(createUrl).not.toHaveBeenCalled()
})
it('cancels a pending export when the account changes', async () => {
  let resolve!: (report: ExportReport) => void
  const pending = new Promise<ExportReport>(done => { resolve = done })
  const build = vi.fn(() => pending)
  const view = render(<MemoryRouter><ExportMenu title="Users" getReport={build} /></MemoryRouter>)
  await csv()
  await waitFor(() => expect(build).toHaveBeenCalledOnce())
  state.user = null
  view.rerender(<MemoryRouter><ExportMenu title="Users" getReport={build} /></MemoryRouter>)
  await act(async () => { resolve(report); await pending })
  expect(createUrl).not.toHaveBeenCalled()
  state.user = { id: 'another-admin' }
  view.rerender(<MemoryRouter><ExportMenu title="Users" getReport={() => report} /></MemoryRouter>)
  await csv()
  await screen.findByText('CSV download ready.')
  expect(createUrl).toHaveBeenCalledOnce()
})
