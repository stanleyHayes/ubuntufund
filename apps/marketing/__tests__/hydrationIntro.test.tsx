import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import createCache from '@emotion/cache'
import { gsap } from 'gsap'
import { afterEach, expect, it, vi } from 'vitest'
import { AppTree } from '../src/App'
import { AppProviders } from '../src/AppProviders'
import { beginHydration, isHydrating } from '../src/lib/hydration'

/**
 * A visitor who lands on the homepage already sees the prerendered headline;
 * the hero's intro animation starts from invisible, so replaying it would hide
 * that text and fade it back in. React hydrates the page (inside the app's
 * Suspense boundary) in a later pass than the shell, and the first-render
 * marker once ran before that pass, so the intro replayed on every landing.
 */
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

it('does not replay the hero intro on the page the visitor landed on', async () => {
  const tree = () => (
    <AppProviders cache={createCache({ key: 'css' })} data={{}}>
      <MemoryRouter initialEntries={['/']}>
        <AppTree />
      </MemoryRouter>
    </AppProviders>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree())
  document.body.appendChild(container)
  const intro = vi.spyOn(gsap, 'matchMedia')
  const recoverable = vi.fn()

  beginHydration()
  await act(async () => {
    hydrateRoot(container, tree(), { onRecoverableError: recoverable })
  })

  expect(recoverable).not.toHaveBeenCalled()
  expect(intro).not.toHaveBeenCalled()
  expect(isHydrating()).toBe(false)
  expect(container.textContent).toContain('we fund what matters')
})
