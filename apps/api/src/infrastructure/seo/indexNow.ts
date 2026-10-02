import { logger } from '../logging/logger.js';

/**
 * IndexNow: tells search engines that public pages changed, instead of waiting
 * for them to re-read the sitemaps.
 *
 * One submission reaches every participating engine (Bing, Yandex, Seznam,
 * Naver and others); Bing's index also feeds ChatGPT search and Copilot. Google
 * does not take part and keeps discovering pages through the sitemaps.
 *
 * Each run collects the public pages that changed since the last successful
 * run (seo/publicPages.ts, the same list the sitemaps publish) and submits
 * them, grouped by host. The key is public by design: engines confirm the
 * submission by fetching https://<host>/<key>.txt, which both sites serve from
 * their public/ folders.
 */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
/** The protocol's limit per request. */
export const MAX_URLS_PER_REQUEST = 10_000;

export interface IndexNowSubmission {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/** The requests for a set of changed URLs: one per host, split at the protocol's limit. */
export function indexNowSubmissions(key: string, urls: string[]): IndexNowSubmission[] {
  const byHost = new Map<string, string[]>();
  for (const url of new Set(urls)) {
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') continue;
      host = parsed.host;
    } catch {
      continue;
    }
    byHost.set(host, [...(byHost.get(host) ?? []), url]);
  }
  const submissions: IndexNowSubmission[] = [];
  for (const [host, list] of byHost) {
    for (let start = 0; start < list.length; start += MAX_URLS_PER_REQUEST) {
      submissions.push({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: list.slice(start, start + MAX_URLS_PER_REQUEST) });
    }
  }
  return submissions;
}

export interface ChangedPage {
  url: string;
  lastmod?: Date;
}

type Fetch = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status'>>;

export class IndexNowNotifier {
  /** Pages changed after this are announced. Advances only after every submission succeeds. */
  private since: Date;

  constructor(
    private readonly key: string,
    private readonly pages: () => Promise<ChangedPage[]>,
    options: { now?: Date; lookback?: number; fetch?: Fetch; endpoint?: string } = {},
  ) {
    // On start, look back a little so a change made during a deploy is not missed.
    this.since = new Date((options.now ?? new Date()).getTime() - (options.lookback ?? 60 * 60_000));
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.endpoint = options.endpoint ?? INDEXNOW_ENDPOINT;
  }

  private readonly fetch: Fetch;
  private readonly endpoint: string;

  /** Submit what changed since the last successful run. Returns how many URLs were accepted. */
  async run(now = new Date()): Promise<number> {
    const changed = (await this.pages())
      .filter((page) => page.lastmod && page.lastmod.getTime() > this.since.getTime() && page.lastmod.getTime() <= now.getTime())
      .map((page) => page.url);
    if (!changed.length) {
      this.since = now;
      return 0;
    }
    let accepted = 0;
    let failed = false;
    for (const submission of indexNowSubmissions(this.key, changed)) {
      try {
        const response = await this.fetch(this.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify(submission),
          signal: AbortSignal.timeout(15_000),
        });
        // 200 and 202 both mean received; anything else is reported and retried next run.
        if (response.ok) accepted += submission.urlList.length;
        else {
          failed = true;
          logger.warn({ host: submission.host, status: response.status, urls: submission.urlList.length }, 'IndexNow submission was not accepted');
        }
      } catch (error) {
        failed = true;
        logger.warn({ host: submission.host, error }, 'IndexNow submission failed');
      }
    }
    if (!failed) this.since = now;
    return accepted;
  }
}
