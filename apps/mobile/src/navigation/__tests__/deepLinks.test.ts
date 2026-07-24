import { describe, it, expect, vi } from 'vitest'

vi.mock('expo-linking', () => ({
  createURL: (path: string) => `exp://127.0.0.1:8081${path}`,
}))

const { linking } = await import('../deepLinks')

describe('deep link configuration', () => {
  it('registers the custom scheme and the Expo dev URL', () => {
    expect(linking.prefixes).toContain('ubuntufund://')
    expect(linking.prefixes).toContain('exp://127.0.0.1:8081/')
  })

  it('maps campaign detail links to the campaign screen', () => {
    expect(linking.config.screens['campaign/[id]']).toBe('campaigns/:id')
  })

  it('maps campaign creation to /campaigns/new', () => {
    expect(linking.config.screens['campaign/create']).toBe('campaigns/new')
  })

  it('routes unknown paths to the not-found screen', () => {
    expect(linking.config.screens['+not-found']).toBe('*')
  })

  it('exposes the core authenticated sections', () => {
    const sections = ['dashboard', 'my-campaigns', 'my-donations', 'settings'] as const
    for (const screen of sections) {
      expect(linking.config.screens[screen]).toBe(screen)
    }
  })
})
