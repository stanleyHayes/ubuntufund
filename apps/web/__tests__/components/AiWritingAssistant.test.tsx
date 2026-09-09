import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import AiWritingAssistant from '@/components/campaigns/AiWritingAssistant'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const view = (value: string, onApply = vi.fn()) => (
  <ThemeProvider theme={ujimoraTheme}>
    <AiWritingAssistant value={value} onApply={onApply} />
  </ThemeProvider>
)
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.get).mockResolvedValue({ enabled: true, remainingRequests: 20, dailyLimit: 20 })
})
describe('Writing assistant', () => {
  it('previews output and changes the story only after Apply', async () => {
    const onApply = vi.fn()
    vi.mocked(api.post).mockResolvedValue({ result: 'A clearer story.', remainingRequests: 19 })
    render(view('Original story', onApply))
    fireEvent.click(await screen.findByRole('button', { name: 'Get suggestion' }))
    await screen.findByText('A clearer story.')
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply to story' }))
    expect(onApply).toHaveBeenCalledWith('A clearer story.')
  })
  it('prevents a late response from overwriting new edits', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const onApply = vi.fn(),
      rendered = render(view('Original', onApply))
    fireEvent.click(await screen.findByRole('button', { name: 'Get suggestion' }))
    rendered.rerender(view('New edits', onApply))
    await act(async () => finish({ result: 'Suggestion' }))
    expect(await screen.findByRole('button', { name: 'Apply to story' })).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })
  it('shows configuration and request errors honestly', async () => {
    vi.mocked(api.get).mockResolvedValue({ enabled: false, remainingRequests: 20, dailyLimit: 20 })
    render(view('Story'))
    await screen.findByText(/AI writing is currently unavailable/)
    expect(screen.queryByRole('button', { name: 'Get suggestion' })).not.toBeInTheDocument()
  })
  it('retains the original text on failure and refreshes the quota', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Daily limit reached'))
    const onApply = vi.fn()
    render(view('Story', onApply))
    fireEvent.click(await screen.findByRole('button', { name: 'Get suggestion' }))
    await screen.findByText('Daily limit reached')
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(onApply).not.toHaveBeenCalled()
  })
})
