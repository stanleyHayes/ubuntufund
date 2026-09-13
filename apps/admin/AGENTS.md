# Admin UI conventions

Apply these conventions to new pages and additions to existing pages. Reuse the established Ujimora design; inspect a comparable existing page before implementing a new surface.

- Preserve the sidebar tree connectors: the vertical line and horizontal branches connecting navigation items are an explicit user requirement for all shell redesigns.
- Use `PageHeader` for page titles, section tone, icon, descriptive text and meaningful statistics. Supply the section SVG icon so the header includes its decorative watermark. Statistics must show skeletons while loading and an unavailable marker on failure, rather than invented zeroes.
- Put page-wide exports in `PageHeader.actions` beside the existing page actions. Keep section-specific exports with their section heading or related controls in a wrapping action group (`ReviewQueueToolbar` for queues). Content exports belong beside Save; avoid isolated export rows and per-button bottom margins. Preserve the section SVG watermarks and allow action groups to wrap at phone widths.
- Export format menus must use the branded raised surface, a heading and guidance, a subtle SVG watermark, and a meaningful icon, title and short description for each format. Preserve keyboard focus, accessible descriptions and narrow-screen wrapping; do not revert to bare format-name lists.
- Use `raisedSurface` and `insetSurface`, the existing Outfit typography and tone tokens. Use the shared `BrandedTextField` for forms and filters. Keep controls and pagination responsive and allow long references to wrap.
- For review/operations queues, reuse `ReviewQueueToolbar`, `ReviewQueueSkeleton` and `ReviewQueueEmpty`. Skeletons should match the loaded card structure, appear on initial fetch and filter/page refresh, and respect reduced motion. Do not substitute loading text, a spinner, or one blank rectangle for a page layout.
- Use the shared illustrated `EmptyState` inside the appropriate branded surface, with relevant copy and an SVG watermark. Show it only after a successful empty response. Failed loads need a clear error and retry path; they must not look like a successfully cleared queue.
- Use the shared `PaginationBar` (or `ReviewQueuePagination` for server queues) with range counts, page-size selection and compact first/previous/numbered/next/last controls. Wire page size to the server query, reset to page one when changing size or filters, and hide pagination for empty/loading/error queues. Use theme-aware disabled colors; avoid plain Previous / Page 1 / Next text rows.
- Preserve authorization, confirmation/evidence requirements, draft retention, pagination and export behavior while changing presentation. Do not leave stale actionable records visible while a new queue is loading.
- Verify representative populated, loading, empty and error states at phone and desktop widths. Inspect screenshots, check overflow, and run relevant interaction tests. Mocked browser checks do not establish live-provider or production behavior.

References: `src/components/PageHeader.tsx`, `src/components/ReviewQueueStates.tsx`, `src/lib/surfaces.ts`, `src/lib/tones.ts`, and `src/pages/NewsletterPage.tsx`.
