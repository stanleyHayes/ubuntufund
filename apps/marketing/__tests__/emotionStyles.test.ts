import { describe, expect, it } from 'vitest'
import type { EmotionCache } from '@emotion/cache'
import { emotionStyleTags } from '../src/lib/emotionStyles'

const cache = (inserted: Record<string, string | true>, registered: Record<string, string>) =>
  ({ key: 'css', inserted, registered }) as unknown as EmotionCache

describe('server style extraction', () => {
  it('emits global rules first, then the class rules this page uses', () => {
    const tags = emotionStyleTags(
      cache({ g1: '@font-face{font-family:A}', abc: '.css-abc{color:red}', unused: '.css-unused{color:blue}', done: true }, { 'css-abc': 'color:red', 'css-unused': 'color:blue' }),
      '<div class="css-abc"></div>',
    )
    expect(tags).toBe('<style data-emotion="css-global g1">@font-face{font-family:A}</style><style data-emotion="css abc">.css-abc{color:red}</style>')
  })

  it('never lets a style value close the <style> element', () => {
    const tags = emotionStyleTags(
      cache({ g1: 'body{background:url("x</STYLE><script>alert(1)</script>")}', abc: '.css-abc{content:"</style><img src=x onerror=alert(1)>"}' }, { 'css-abc': '' }),
      '<p class="css-abc"></p>',
    )
    expect(tags.match(/<\/style>/gi)).toHaveLength(2)
    expect(tags).not.toMatch(/<\/style><(script|img)/i)
  })
})
