import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false },
  params: {} as Record<string, string | undefined>,
  redirects: [] as unknown[],
}))
vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => { m.redirects.push(href); return null },
  useLocalSearchParams: () => m.params,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/components/Loading', () => ({ PageSkeleton: () => null }))
import Index from '../../../app/index'
beforeEach(() => { m.auth = { isLoading: false, isAuthenticated: false }; m.params = {}; m.redirects = [] })
afterEach(cleanup)

it('opens sign-up with the code when a signed-out visitor follows a referral link', () => {
  m.params = { ref: ' ama-fund ' }
  render(createElement(Index))
  expect(m.redirects).toEqual([{ pathname: '/(auth)/register', params: { ref: 'ama-fund' } }])
})

it('sends a signed-in member who follows a referral link to Home, not the sign-up form', () => {
  m.auth.isAuthenticated = true
  m.params = { ref: 'ama-fund' }
  render(createElement(Index))
  expect(m.redirects).toEqual(['/(tabs)'])
})

it('waits for the session before deciding', () => {
  m.auth.isLoading = true
  m.params = { ref: 'ama-fund' }
  render(createElement(Index))
  expect(m.redirects).toEqual([])
})

it('opens Home for a plain launch', () => {
  render(createElement(Index))
  expect(m.redirects).toEqual(['/(tabs)'])
})
