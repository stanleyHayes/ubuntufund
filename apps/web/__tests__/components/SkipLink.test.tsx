import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout, MAIN_CONTENT_ID } from '@/components/layout/Layout'

// The header is a long run of links; stand-ins keep this test about the skip link.
vi.mock('@/components/layout/Header', () => ({ Header: () => <nav><a href="/explore">Explore</a><a href="/dashboard">Dashboard</a></nav> }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer /> }))
vi.mock('@/components/layout/MobileBottomNav', () => ({ MobileBottomNav: () => null }))
vi.mock('@/components/auth/WebsiteRequestNotice', () => ({ WebsiteRequestNotice: () => null }))
vi.mock('@/components/auth/AccountAgreement', () => ({ AccountAgreementNotice: () => null }))

/**
 * Keyboard-only users had to tab through the whole header on every page
 * before reaching its content (WCAG 2.4.1, bypass blocks).
 */
describe('Layout skip link', () => {
  function renderLayout() {
    window.scrollTo = vi.fn()
    return render(
      <MemoryRouter initialEntries={['/explore']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/explore" element={<h1>Explore campaigns</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('is the first focusable element and points at the main content', () => {
    const { container } = renderLayout()
    const first = container.querySelector('a[href], button, input, [tabindex]:not([tabindex="-1"])')
    expect(first).toHaveTextContent('Skip to main content')
    expect(first).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`)
    expect(screen.getByRole('main')).toHaveAttribute('id', MAIN_CONTENT_ID)
  })

  it('moves focus to the main content without a router hash change', () => {
    renderLayout()
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    link.focus()
    expect(document.activeElement).toBe(link)
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(screen.getByRole('main'))
    expect(screen.getByRole('heading', { name: 'Explore campaigns' })).toBeInTheDocument()
  })
})
