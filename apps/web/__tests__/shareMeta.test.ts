import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import middleware, { config } from '../middleware'
import { campaignKeyFromPath, campaignShareMeta, escapeHtml, injectShareMeta, isLinkPreviewBot } from '@/lib/shareMeta'

// Vitest runs with apps/web as the cwd; this is the real shipped head.
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const WHATSAPP = 'WhatsApp/2.23.20.0 A'
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

const campaign = {
  id: 'a1b2c3d4e5f6a1b2c3d4e5f6',
  slug: 'kofi-surgery',
  title: 'Kofi "Junior" <Asante> & family 🙏',
  description: 'Help Kofi get the surgery he needs at Korle Bu. Every cedi counts towards the operation and his recovery.',
  imageUrls: ['https://res.cloudinary.com/demo/image/upload/kofi.jpg'],
  socialPreview: { title: 'Kofi "Junior" <Asante> & family 🙏', summary: 'Help Kofi get the surgery he needs at Korle Bu. Every cedi counts towards the operation and his recovery.', imageUrl: 'https://res.cloudinary.com/demo/image/upload/kofi.jpg', canonicalUrl: 'https://app.ujimora.com/c/kofi-surgery' },
}

describe('share meta helpers', () => {
  it('recognises link-preview scrapers but not browsers', () => {
    for (const ua of [WHATSAPP, 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'LinkedInBot/1.0', 'Slackbot-LinkExpanding 1.0', 'Twitterbot/1.0', 'TelegramBot (like TwitterBot)']) {
      expect(isLinkPreviewBot(ua), ua).toBe(true)
    }
    expect(isLinkPreviewBot(CHROME)).toBe(false)
    expect(isLinkPreviewBot(null)).toBe(false)
  })

  it('extracts only shareable campaign keys', () => {
    expect(campaignKeyFromPath('/c/kofi-surgery')).toBe('kofi-surgery')
    expect(campaignKeyFromPath('/c/kofi-surgery/donate')).toBe('kofi-surgery')
    expect(campaignKeyFromPath('/campaigns/a1b2c3d4e5f6a1b2c3d4e5f6')).toBe('a1b2c3d4e5f6a1b2c3d4e5f6')
    expect(campaignKeyFromPath('/campaigns/new')).toBeNull()
    expect(campaignKeyFromPath('/c/kofi/live/abc')).toBeNull()
    expect(campaignKeyFromPath('/c/%3Cscript%3E')).toBeNull()
    expect(campaignKeyFromPath('/c/%E0%A4%A')).toBeNull()
  })

  it('escapes every character that could break out of an attribute or element', () => {
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;')
  })

  it('rewrites the existing share tags in place with escaped campaign values', () => {
    const html = injectShareMeta(INDEX_HTML, campaignShareMeta(campaign, 'https://app.ujimora.com'))
    const escapedTitle = 'Kofi &quot;Junior&quot; &lt;Asante&gt; &amp; family 🙏 | Ujimora'
    expect(html).toContain(`<title>${escapedTitle}</title>`)
    expect(html).toContain(`<meta property="og:title" content="${escapedTitle}" />`)
    expect(html).toContain(`<meta name="twitter:title" content="${escapedTitle}" />`)
    expect(html).toContain('<meta property="og:url" content="https://app.ujimora.com/c/kofi-surgery" />')
    expect(html).toContain('<meta property="og:image" content="https://res.cloudinary.com/demo/image/upload/kofi.jpg" />')
    expect(html).toContain('<meta name="twitter:image" content="https://res.cloudinary.com/demo/image/upload/kofi.jpg" />')
    expect(html).toContain('<meta property="og:type" content="article" />')
    expect(html).toContain('<link rel="canonical" href="https://app.ujimora.com/c/kofi-surgery" />')
    expect(html).not.toContain('og:image:width')
    expect(html).not.toContain('<Asante>')
    // Still exactly one of each tag, and the rest of the document is intact.
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html).toContain('<div id="root"></div>')
  })

  it('keeps the static image when the campaign has no https cover', () => {
    const html = injectShareMeta(INDEX_HTML, campaignShareMeta({ ...campaign, imageUrls: [], socialPreview: { ...campaign.socialPreview, imageUrl: 'http://insecure.example/x.jpg' } }, 'https://app.ujimora.com'))
    expect(html).toContain('<meta property="og:image" content="https://ujimora.com/og-image.png" />')
    expect(html).toContain('og:image:width')
  })
})

describe('link-preview middleware', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const call = (path: string, ua: string) => middleware(new Request(`https://app.ujimora.com${path}`, { headers: { 'user-agent': ua } }))
  function stubFetch(api: () => Promise<Response>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/index.html') ? new Response(INDEX_HTML, { status: 200 }) : api())
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('only runs for campaign share paths', () => {
    expect(config.matcher).toEqual(['/c/:slug', '/c/:slug/donate', '/campaigns/:id'])
  })

  it('leaves browsers alone without calling the API', async () => {
    const fetchMock = stubFetch(async () => new Response('{}'))
    expect(await call('/c/kofi-surgery', CHROME)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves scrapers the campaign card for a public campaign', async () => {
    const fetchMock = stubFetch(async () => Response.json({ data: campaign }))
    const response = await call('/c/kofi-surgery/donate', WHATSAPP)
    expect(response?.status).toBe(200)
    expect(response?.headers.get('content-type')).toContain('text/html')
    expect(await response?.text()).toContain('<meta property="og:url" content="https://app.ujimora.com/c/kofi-surgery" />')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.ujimora.com/api/v1/campaigns/slug/kofi-surgery/public')
  })

  it('falls through for campaigns that are not public or not found', async () => {
    stubFetch(async () => Response.json({ message: 'Campaign not found' }, { status: 404 }))
    expect(await call('/c/pending-review-campaign', WHATSAPP)).toBeUndefined()
  })

  it('falls through when the API is slow or unreachable', async () => {
    stubFetch(async () => { throw new DOMException('The operation timed out.', 'TimeoutError') })
    expect(await call('/campaigns/a1b2c3d4e5f6a1b2c3d4e5f6', WHATSAPP)).toBeUndefined()
  })

  it('falls through on a malformed API payload', async () => {
    stubFetch(async () => new Response('<html>gateway error</html>', { status: 200 }))
    expect(await call('/c/kofi-surgery', WHATSAPP)).toBeUndefined()
  })
})

describe('link-preview middleware on Vercel', () => {
  // Vercel runs middleware.ts as a Node.js ES module, transpiled file by file
  // (apps/web is "type": "module"). Vitest's resolver is more forgiving than
  // Node's: an extensionless relative import passes here but crashed every
  // campaign page in production with ERR_MODULE_NOT_FOUND. So transpile the
  // middleware and its helpers the same way and load them in a real Node process.
  function runInNode(script: string) {
    const dir = mkdtempSync(join(tmpdir(), 'ujimora-middleware-'))
    try {
      for (const file of ['middleware.ts', 'src/lib/shareMeta.ts']) {
        const out = join(dir, file.replace(/\.ts$/, '.js'))
        mkdirSync(dirname(out), { recursive: true })
        const source = readFileSync(resolve(process.cwd(), file), 'utf8')
        writeFileSync(out, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
      }
      writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
      writeFileSync(join(dir, 'index.html'), INDEX_HTML)
      return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir, encoding: 'utf8', timeout: 30_000 })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('loads and lets browsers through under Node.js ESM', () => {
    const result = runInNode(`
      const { default: middleware } = await import('./middleware.js')
      const response = await middleware(new Request('https://app.ujimora.com/campaigns/new', { headers: { 'user-agent': ${JSON.stringify(CHROME)} } }))
      console.log(JSON.stringify({ passedThrough: response === undefined }))
    `)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({ passedThrough: true })
  })

  it('serves scrapers the campaign card under Node.js ESM', () => {
    const result = runInNode(`
      import { readFileSync } from 'node:fs'
      const html = readFileSync('./index.html', 'utf8')
      globalThis.fetch = async (input) => String(input).endsWith('/index.html') ? new Response(html) : Response.json({ data: ${JSON.stringify(campaign)} })
      const { default: middleware } = await import('./middleware.js')
      const response = await middleware(new Request('https://app.ujimora.com/c/kofi-surgery', { headers: { 'user-agent': ${JSON.stringify(WHATSAPP)} } }))
      const body = await response.text()
      console.log(JSON.stringify({ status: response.status, card: body.includes('<meta property="og:url" content="https://app.ujimora.com/c/kofi-surgery" />') }))
    `)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({ status: 200, card: true })
  })
})
