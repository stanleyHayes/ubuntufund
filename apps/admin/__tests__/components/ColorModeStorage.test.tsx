import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColorModeProvider } from '../../src/context/ColorModeContext'

// Blocked site data makes the localStorage getter throw; the provider sits
// above the router, so a throw here blanked the whole console.
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
afterEach(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original) })

describe('admin ColorModeProvider without storage', () => {
  it('renders its children (dark-first default) when storage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('The operation is insecure.', 'SecurityError') },
    })
    render(<ColorModeProvider><p>Console content</p></ColorModeProvider>)
    expect(screen.getByText('Console content')).toBeInTheDocument()
  })
})
