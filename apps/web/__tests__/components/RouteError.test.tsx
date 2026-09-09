import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { RouteError } from '../../src/components/RouteError'

describe('route recovery', () => {
  it('offers recovery when an outdated page chunk cannot load without exposing a stack trace', async () => {
    const router = createMemoryRouter([{ path: '/', loader: () => { throw new TypeError('Failed to fetch dynamically imported module: /assets/old.js') }, element: <div>Page</div>, errorElement: <RouteError /> }])
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'This page needs a refresh' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh page' })).toBeTruthy()
    expect(screen.queryByText(/old.js/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/')
  })
})
