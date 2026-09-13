# Admin UI conventions

Apply these conventions to new pages and additions to existing pages. Reuse the established Ujimora design; inspect a comparable existing page before implementing a new surface.

- Use `PageHeader` for page titles, section tone, icon, descriptive text and meaningful statistics. Supply the section SVG icon so the header includes its decorative watermark. Statistics must show skeletons while loading and an unavailable marker on failure, rather than invented zeroes.
- Use `raisedSurface` and `insetSurface`, the existing Outfit typography and tone tokens. Use the shared `BrandedTextField` for forms and filters. Keep controls and pagination responsive and allow long references to wrap.
- For review/operations queues, reuse `ReviewQueueToolbar`, `ReviewQueueSkeleton` and `ReviewQueueEmpty`. Skeletons should match the loaded card structure, appear on initial fetch and filter/page refresh, and respect reduced motion. Do not substitute loading text, a spinner, or one blank rectangle for a page layout.
- Use the shared illustrated `EmptyState` inside the appropriate branded surface, with relevant copy and an SVG watermark. Show it only after a successful empty response. Failed loads need a clear error and retry path; they must not look like a successfully cleared queue.
- Preserve authorization, confirmation/evidence requirements, draft retention, pagination and export behavior while changing presentation. Do not leave stale actionable records visible while a new queue is loading.
- Verify representative populated, loading, empty and error states at phone and desktop widths. Inspect screenshots, check overflow, and run relevant interaction tests. Mocked browser checks do not establish live-provider or production behavior.

References: `src/components/PageHeader.tsx`, `src/components/ReviewQueueStates.tsx`, `src/lib/surfaces.ts`, `src/lib/tones.ts`, and `src/pages/NewsletterPage.tsx`.
