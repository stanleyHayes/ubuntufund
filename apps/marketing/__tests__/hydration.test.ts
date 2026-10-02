import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, SKINS, prefersNonDefaultLook, readStoredLook } from '../src/lib/hydration'

/**
 * Pages are prerendered in the default look. A visitor who saved another look
 * gets a fresh render instead of hydration (main.tsx), and an inline script in
 * index.html hides the page until then. The two decisions are written twice,
 * once in the app and once in plain JavaScript that runs before it, so this
 * holds them to the same answer for every stored value.
 */
const store = (values: Record<string, string | null>) => ({ getItem: (key: string) => values[key] ?? null })

function inlineScriptDecision(values: Record<string, string | null> | 'throws'): string | null {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  if (!script) throw new Error('index.html has no inline look script')
  let attribute: string | null = null
  const localStorage = values === 'throws'
    ? { getItem: () => { throw new Error('blocked') } }
    : store(values)
  runInNewContext(script, {
    localStorage,
    document: { documentElement: { setAttribute: (_name: string, value: string) => { attribute = value } } },
  })
  return attribute
}

describe('the prerendered look', () => {
  it('reads the default look when nothing valid is stored', () => {
    expect(readStoredLook(undefined)).toEqual(DEFAULT_LOOK)
    expect(readStoredLook(store({}))).toEqual(DEFAULT_LOOK)
    expect(readStoredLook(store({ uf_skin: 'not-a-skin', uf_color_mode: 'sepia' }))).toEqual(DEFAULT_LOOK)
    expect(readStoredLook({ getItem: () => { throw new Error('blocked') } })).toEqual(DEFAULT_LOOK)
  })

  it('reads a saved look', () => {
    expect(readStoredLook(store({ uf_color_mode: 'dark', uf_skin: 'minimal' }))).toEqual({ darkMode: true, skin: 'minimal' })
  })

  const cases: Record<string, string | null>[] = [
    {},
    { uf_color_mode: 'light' },
    { uf_color_mode: 'dark' },
    { uf_skin: 'not-a-skin' },
    ...SKINS.map((skin) => ({ uf_skin: skin })),
    ...SKINS.map((skin) => ({ uf_skin: skin, uf_color_mode: 'dark' })),
  ]

  it.each(cases.map((values) => [JSON.stringify(values), values] as const))('the inline script and the app agree for %s', (_label, values) => {
    expect(inlineScriptDecision(values) !== null).toBe(prefersNonDefaultLook(store(values)))
  })

  it('the inline script tolerates storage that throws, as the app does', () => {
    expect(inlineScriptDecision('throws')).toBeNull()
    expect(prefersNonDefaultLook({ getItem: () => { throw new Error('blocked') } })).toBe(false)
  })
})
