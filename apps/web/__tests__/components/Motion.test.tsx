import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useEntrance } from '@/components/motion/useEntrance'

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')

function Surface() {
  const ref = useEntrance<HTMLDivElement>()
  return (
    <div ref={ref}>
      <button>Continue</button>
    </div>
  )
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).animate
})

function setup(reduced = false) {
  let notify!: IntersectionObserverCallback
  const disconnect = vi.fn()
  const cancel = vi.fn()
  const animate = vi.fn(() => ({ cancel }))
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
  const preference = { matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => preference),
  )
  const observe = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  return {
    animate,
    cancel,
    observe,
    enter: () =>
      notify([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver),
  }
}
it('keeps content visible and skips observers for reduced motion', () => {
  const motion = setup(true)
  const { getByText } = render(<Surface />)
  expect(getByText('Continue')).toBeVisible()
  expect(motion.observe).not.toHaveBeenCalled()
  expect(motion.animate).not.toHaveBeenCalled()
})
it('reveals on intersection and cancels motion when the user focuses a control', () => {
  const motion = setup()
  const { getByText, unmount } = render(<Surface />)
  act(() => motion.enter())
  expect(motion.animate).toHaveBeenCalledTimes(1)
  act(() => getByText('Continue').focus())
  expect(motion.cancel).toHaveBeenCalled()
  unmount()
})
it('does not animate a surface whose control already has focus', () => {
  const motion = setup()
  const { getByText } = render(<Surface />)
  act(() => getByText('Continue').focus())
  act(() => motion.enter())
  expect(motion.animate).not.toHaveBeenCalled()
})
