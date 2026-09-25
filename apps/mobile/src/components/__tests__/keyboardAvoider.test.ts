import { createElement } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ os: 'android', kav: vi.fn(), windowY: 88 }))
vi.mock('react-native', async () => {
  const React = await import('react')
  const View = React.forwardRef(({ children, onLayout }: { children?: React.ReactNode; onLayout?: () => void }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (callback: (x: number, y: number) => void) => callback(0, m.windowY) }))
    React.useEffect(() => { onLayout?.() }, [onLayout])
    return React.createElement('div', {}, children)
  })
  return {
    Platform: { get OS() { return m.os } },
    View,
    KeyboardAvoidingView: (props: { children: React.ReactNode; behavior?: string; keyboardVerticalOffset?: number }) => { m.kav({ behavior: props.behavior, offset: props.keyboardVerticalOffset }); return React.createElement('div', {}, props.children) },
  }
})
import { KeyboardAvoider, keyboardBehavior } from '../KeyboardAvoider'
afterEach(() => { cleanup(); m.kav.mockClear() })

it('always pads on Android and keeps the screen choice on iOS', () => {
  expect(keyboardBehavior('android')).toBe('padding')
  expect(keyboardBehavior('android', undefined)).toBe('padding')
  expect(keyboardBehavior('ios')).toBeUndefined()
  expect(keyboardBehavior('ios', 'padding')).toBe('padding')
  expect(keyboardBehavior('web', 'padding')).toBeUndefined()
})

it('offsets Android padding by the avoiding view position under the header', async () => {
  m.os = 'android'
  render(createElement(KeyboardAvoider, null, createElement('input')))
  await waitFor(() => expect(m.kav).toHaveBeenLastCalledWith({ behavior: 'padding', offset: 88 }))
})

it('leaves iOS unchanged (no measured offset)', () => {
  m.os = 'ios'
  render(createElement(KeyboardAvoider, { iosBehavior: 'padding' }, createElement('input')))
  expect(m.kav).toHaveBeenLastCalledWith({ behavior: 'padding', offset: 0 })
  m.kav.mockClear(); cleanup()
  render(createElement(KeyboardAvoider, null, createElement('input')))
  expect(m.kav).toHaveBeenLastCalledWith({ behavior: undefined, offset: 0 })
})
