# Blog studio

Administrators open **Content → Blog** (`/content/blog`) and choose **Create article**. The existing sidebar connectors remain intact.

## Authoring and publication

1. **Details:** title, stable URL slug, summary, category, author and featured placement.
2. **Write:** a Tiptap editor with headings, bold/italic/strikethrough, lists and checklists, quotes, code blocks, links, uploaded images, editable tables, dividers and undo/redo. Markdown source and a safe preview share the public renderer.
3. **Media:** the existing authenticated upload API, progress, replacement/removal and required accessible cover description.
4. **Review:** complete article preview, missing-field guidance and an unchecked review confirmation before publication.

Draft saves return to a persistent article URL. Navigation warns about unsaved edits. Saves and publication use revision checks so another editor's changes cannot be silently overwritten. Editing a published article changes only the draft until explicitly published again. Unpublishing retains the draft. The article list uses branded skeleton/error/retry/empty states and shared pagination; its PDF/Excel/CSV export sits beside Create article.

The API uses a separate `blogposts` collection. Public reads return only the published snapshot. Admin routes require authentication and the existing admin role middleware. Publication validates metadata, HTTPS cover URL and content completeness; unique published slugs cannot collide. Raw HTML and unsafe links are not executed by the shared Markdown renderer. This is an editorial CMS, not a collaborative Jira integration.

On an empty collection, a transaction migrates the six previously public static articles without changing their copy. Later starts do not overwrite records or republish withdrawn articles. `/api/v1/blog/sitemap.xml` lists current published URLs; marketing robots.txt advertises it. Static article sitemap entries were removed to avoid stale withdrawn links.

## Related UI fixes

- Contact submission dialogs use branded theme surfaces, readable fields/chips and a visible close button. Failed updates display an error and retain notes; controls are locked during submission.
- About-page team images with root-relative paths resolve against the marketing origin (`VITE_MARKETING_URL`, default `https://ujimora.com`). Stored content is unchanged.
- The shared image uploader displays a skeleton while loading and a compact, accessible retry state on failure, retaining Replace/Remove actions.

## Verification

- Three real MongoDB/API integration tests cover private drafts/revisions, stale revision rejection, unpublishing, admin authorization, invalid/incomplete publication, first-run migration preservation and published-only sitemap entries.
- Six mocked Chromium flows cover authoring/upload/review/publication at 390/1440px; light/dark contact error retention and photo retry; list loading/error/empty states at both widths. Screenshots inspected under `/tmp/ujimora-blog-*`, `/tmp/ujimora-contact-dialog-*`, `/tmp/ujimora-photo-preview-*`.
- Marketing tests cover public Markdown, accessible cover text, unsafe content handling and load failure retry, plus existing sitemap/newsletter/not-found tests.
- Type checks and production builds cover API/admin/marketing/shared types and UI. Lint retains only pre-existing unrelated warnings. The editor is lazy-loaded.
- Mocked uploads establish the browser/API contract; they do not establish live Cloudinary delivery. Production deployment verification is recorded separately in the root ledger.
