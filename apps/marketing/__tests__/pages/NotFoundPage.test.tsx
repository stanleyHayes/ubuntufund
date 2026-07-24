import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ubuntuFundTheme } from '@ubuntu-fund/ui'
import NotFoundPage from '@/pages/NotFoundPage'

function renderPage() {
  return render(
    <ThemeProvider theme={ubuntuFundTheme}>
      <MemoryRouter initialEntries={['/does-not-exist']}>
        <NotFoundPage />
      </MemoryRouter>
    </ThemeProvider>
  )
}

describe('NotFoundPage', () => {
  it('renders without crashing', () => {
    renderPage()
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  it('offers a way back to the home page', () => {
    renderPage()
    const homeLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/')
    expect(homeLinks.length).toBeGreaterThan(0)
  })
})
