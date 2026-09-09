# Legal reading experience and native policy parity

## Confirmed failure

The screenshot references `/assets/TermsPage-7JNF3ELi.js`. A live header check on 9 September 2026 returned HTTP 200 with `Content-Type: text/html`, the same ETag and body length as `/terms`. The missing asset is falling through Vercel's catch-all SPA rewrite. A stale tab after deployment is a likely trigger; the original browsing session was not available to confirm that trigger.

## Changes

- Web legal pages load with the application shell instead of separate lazy page chunks. The router now shows a branded, actionable refresh/home recovery screen on failed navigation, without displaying internal error stacks.
- The SPA rewrite excludes `/assets/` and `/api/` requests. Existing API proxy routing is retained. This follows Vercel's documented negative-lookahead rewrite syntax: https://vercel.com/docs/project-configuration/vercel-json . Missing assets must return an asset error, not application HTML; production headers must be checked again after deployment.
- `packages/types/src/legal.ts` contains the existing full marketing policy content as plain data. Marketing retains its icon adapter; web and native consume the same content directly. No new legal claims or compliance conclusions were authored in this UI migration. Existing creator entitlement/withdrawal and crypto sections are retained.
- All eight policies are available publicly: Terms of Use, Privacy Notice, Organizer Agreement, Contributor Terms, Payout/Refund, Acceptable Use, Cookies, and Subscription/Billing. `/legal` is the collection index.
- Web uses the current appearance tokens, a restrained interlocking SVG watermark, responsive reading width, section navigation, effective dates, contact details and links back to the collection.
- Native provides every policy inside the app, bundled for offline reading, selectable text, wrapping section links, native section navigation and appearance-aware surfaces. The collection is linked from the profile menu and individual policies.

## Validation

- Web, mobile and marketing TypeScript checks passed.
- Web production build passed; existing bundle-size advisory remains.
- Web tests: 40 passed, including failed chunk recovery without a leaked error stack.
- Mobile logic tests: 21 passed (session, payments, KYC and navigation; not a substitute for UI acceptance).
- Browser checks cover all eight public routes, index links, narrow-screen overflow and section anchors.
- Full native iOS simulator build and installation passed. The public legal hub opens from Profile without login; all eight direct policy links opened the expected document. Privacy section navigation, light/dark layouts and all four material finishes were visually checked. Original appearance preferences were restored. Camera and live-provider acceptance remain part of the wider mobile parity goal.

These changes are local until published. The running production deployment is not claimed fixed yet.
