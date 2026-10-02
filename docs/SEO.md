# Search visibility (SEO)

How ujimora.com, app.ujimora.com and the API make Ujimora findable, what to keep true when you change them, and what only the owner can do.

## What crawlers receive

| Host | What a crawler gets | Where it is built |
| --- | --- | --- |
| ujimora.com | Every page as finished HTML: its own head, its text, its CSS and the API data it shows | `apps/marketing/scripts/prerender.ts` at build time |
| app.ujimora.com | Campaign, organization and creator pages with their head and text in the HTML, for search engines and AI crawlers | `apps/web/middleware.ts` + `src/lib/crawlerPages.ts` per request |
| app.ujimora.com | Link-preview cards (WhatsApp, Facebook, X…) for campaigns | `apps/web/middleware.ts` + `src/lib/shareMeta.ts` |
| admin.ujimora.com | `noindex, nofollow` on every response | `apps/admin/vercel.json`, `index.html`, `public/robots.txt` |
| api.ujimora.com | Sitemap for app.ujimora.com, blog sitemap, IndexNow pings | `seo/publicPages.ts`, `seo/indexNow.ts` |

### ujimora.com: prerendered pages

The marketing site is a React single-page app, but every route ships as complete HTML:

1. `vite build` builds the browser bundle as usual.
2. The `prerender` plugin loads `src/entry-server.tsx` and renders each route with React on the server: every static page, every guide, every policy and every published blog post.
3. Each page's head comes from the page itself: whatever it passes to `useSeo` (title, description, canonical, robots, JSON-LD) is collected while it renders, so the HTML and the browser can never disagree. The build stops if a page declares another page's path as its own.
4. On Vercel builds (`VERCEL=1`, or locally `PRERENDER_DATA=1`) the plugin first fetches what the pages read from the API: CMS blocks, blog posts, live plans and testimonials. Pages render with that data, and each page embeds only the data it read, so the browser's first render matches the HTML. Pages still refresh from the API after loading. A failed fetch never fails the build; that page renders its fallback.
5. The browser adopts the HTML (`hydrateRoot` in `src/main.tsx`) instead of drawing it again. Visitors who saved dark mode or another skin get a fresh render in their look; an inline script in `index.html` keeps the page hidden until then so it never flashes the wrong theme.

Also written by the build: `404.html` (served with HTTP 404 for unknown URLs), `app-shell.html` (only for blog posts published after the last deploy) and `llms.txt` (a plain summary for AI assistants).

Rules that keep hydration working, enforced by `__tests__/ssrRender.test.tsx` and a browser check:

- Do not read `window`, `document` or storage while rendering; do it in effects.
- Format dates and numbers with an explicit locale and time zone (`'en-GB'`, `timeZone: 'UTC'`, `'en-GH'`).
- Do not render random values or the current time; round trigonometry used in SVG coordinates.
- Entrance animations must not hide content the visitor landed on (see `isHydrating()` in `src/lib/hydration.ts`).

### Search guides

`apps/marketing/src/data/guides.ts` holds the pages written to rank for what people in Ghana search: crowdfunding in Ghana, starting a fundraiser, medical bills, school fees, funerals, churches, community projects, emergencies, giving from abroad, mobile money, trust and safety, and GoFundMe not paying out in Ghana. `/guides` lists them all; the navbar and every footer link to them.

To add a guide: add an entry to `GUIDES`, add its URL to `public/sitemap.xml` with today's `lastmod`, and add it to the footer. `__tests__/guides.test.ts` fails until the title (60 characters at most), description (110 to 160), links, sitemap entry and footer link are right.

Copy must stay true. `__tests__/publicClaims.test.ts` rejects known false claims, for example that campaigns are "verified" (organizers are verified; campaigns are screened), escrow, or a review turnaround. Plan fees appear in the copy because the owner fixed them (Free 5%, Starter 3.5%, Pro and Organization 2%, Enterprise 1%); if they change, change the guides and `llms.txt` too.

### app.ujimora.com: crawler pages

Search engines and AI crawlers (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot and others; see `SEARCH_CRAWLER`) requesting `/c/:slug`, `/campaigns/:id`, `/organizations/:slug` or `/creators/:handle` get index.html with:

- the same head the page sets in the browser: `src/lib/publicPageSeo.ts` is shared by the pages and the middleware;
- the record's text as plain HTML inside `#root`; the app script stays, so React replaces it when it runs.

A record the API reports missing answers 404. `/campaigns/:id` and old slugs answer 301 to the campaign's current `/c/:slug`. API trouble returns nothing, so the crawler gets the normal app. People never pass through this path.

### Sitemaps, robots and IndexNow

- `https://ujimora.com/sitemap.xml`: hand-maintained; `__tests__/prerender.test.ts` keeps it equal to the routes the build writes.
- `https://ujimora.com/api/v1/blog/sitemap.xml`: published blog posts.
- `https://app.ujimora.com/sitemap.xml`: open campaigns, creator pages and organization profiles, built per request from `apps/api/src/infrastructure/seo/publicPages.ts`.
- IndexNow: every 15 minutes the API submits the pages from those lists that changed since the last successful run (`INDEXNOW_ENABLED`, `INDEXNOW_KEY` in `render.yaml`). The key is public by design and must match the `<key>.txt` files in `apps/web/public` and `apps/marketing/public`; a test checks this.

## Checking a deploy

```sh
# Marketing pages carry their own text and head
curl -s https://ujimora.com/medical-fundraising | grep -o '<h1[^<]*'
curl -s -o /dev/null -w '%{http_code}\n' https://ujimora.com/no-such-page      # 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://ujimora.com/pricing/  # 308 → /pricing
curl -s https://ujimora.com/llms.txt | head

# Crawler pages on the app (replace the slug with a live campaign)
curl -s -A 'Googlebot/2.1' https://app.ujimora.com/c/<slug> | grep -o '<h1>[^<]*'
curl -s https://app.ujimora.com/sitemap.xml | head

# Admin stays out of search results
curl -sI https://admin.ujimora.com/ | grep -i x-robots-tag
```

## Owner checklist (needs your accounts)

1. **Google Search Console.** Add `ujimora.com` as a Domain property (DNS verification covers app.ujimora.com too). Submit the three sitemaps above. Use URL Inspection → Request indexing for `/`, `/crowdfunding-ghana`, `/guides` and the main guides.
2. **Bing Webmaster Tools.** Import the sites from Search Console. IndexNow then reports there automatically.
3. **Social profiles.** Enter the real ones in Admin → Content → Contact. The next deploy adds them to the site's structured data (`sameAs`). Until then none are claimed, because an invented profile URL is a false identity claim.
4. **About page heading.** Its H1 comes from Admin → Content → About and repeats the homepage tagline ("Together, we fund what matters"). A distinct heading such as "Why we built Ujimora" helps both pages.
5. **Google Business Profile** for the Accra office, with the website set to `https://ujimora.com`.
6. **Links from others:** church, NGO and alumni partners, Ghanaian startup directories, and press. Search engines weigh these heavily, and no code change replaces them.
7. **Fresh content:** a blog post a month on real campaigns (with consent) builds the site's authority; publishing it triggers IndexNow.
