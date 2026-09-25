import { describe, expect, it, vi } from 'vitest'
import { confirmDestructive, removePayoutAccountPrompt, type ConfirmDeps } from '../confirmDestructive'

const prompt = removePayoutAccountPrompt({ accountName: 'Kwame Mensah', last4: '4567' })

describe('confirming a saved payout account removal', () => {
  it('describes the account and what removal means', () => {
    expect(prompt.title).toBe('Remove saved account?')
    expect(prompt.message).toContain('Kwame Mensah ending 4567')
    expect(prompt.message).toContain('keep their original destination')
  })

  it.each([
    ['Remove account', true],
    ['Cancel', false],
  ])('on native resolves from the %s button', async (label, expected) => {
    const alert = vi.fn<ConfirmDeps['alert']>((_t, _m, buttons) => buttons.find((b) => b.text === label)?.onPress?.())
    await expect(confirmDestructive(prompt, { platform: 'ios', alert, webConfirm: vi.fn() })).resolves.toBe(expected)
    expect(alert.mock.calls[0][2].map((b) => b.style)).toEqual(['cancel', 'destructive'])
  })

  it('treats dismissing the native alert as cancel', async () => {
    const alert = vi.fn<ConfirmDeps['alert']>((_t, _m, _b, options) => options?.onDismiss?.())
    await expect(confirmDestructive(prompt, { platform: 'android', alert, webConfirm: vi.fn() })).resolves.toBe(false)
  })

  it('uses the browser confirm on Expo web, where Alert.alert is a no-op', async () => {
    const webConfirm = vi.fn(() => true)
    const alert = vi.fn()
    await expect(confirmDestructive(prompt, { platform: 'web', alert, webConfirm })).resolves.toBe(true)
    expect(webConfirm).toHaveBeenCalledWith(expect.stringContaining('Remove saved account?'))
    expect(alert).not.toHaveBeenCalled()
  })
})
