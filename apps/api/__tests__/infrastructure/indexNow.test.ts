import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IndexNowNotifier, MAX_URLS_PER_REQUEST, indexNowSubmissions } from '../../src/infrastructure/seo/indexNow.js';

const repoRoot = resolve(__dirname, '../../../..');
const KEY = 'test-key-123456';
const minute = 60_000;

describe('IndexNow submissions', () => {
  it('groups URLs by host, once each, with the key file on that host', () => {
    const submissions = indexNowSubmissions(KEY, [
      'https://app.ujimora.com/c/a',
      'https://app.ujimora.com/c/a',
      'https://ujimora.com/blog/b',
      'http://app.ujimora.com/c/insecure',
      'not a url',
    ]);
    expect(submissions).toEqual([
      { host: 'app.ujimora.com', key: KEY, keyLocation: `https://app.ujimora.com/${KEY}.txt`, urlList: ['https://app.ujimora.com/c/a'] },
      { host: 'ujimora.com', key: KEY, keyLocation: `https://ujimora.com/${KEY}.txt`, urlList: ['https://ujimora.com/blog/b'] },
    ]);
  });

  it('splits a large change set at the protocol limit', () => {
    const urls = Array.from({ length: MAX_URLS_PER_REQUEST + 5 }, (_, i) => `https://app.ujimora.com/c/campaign-${i}`);
    const submissions = indexNowSubmissions(KEY, urls);
    expect(submissions.map((s) => s.urlList.length)).toEqual([MAX_URLS_PER_REQUEST, 5]);
  });
});

describe('IndexNow notifier', () => {
  const start = new Date('2026-10-02T12:00:00Z');
  const at = (offsetMinutes: number) => new Date(start.getTime() + offsetMinutes * minute);

  function notifier(pages: { url: string; lastmod?: Date }[], respond: () => Promise<{ ok: boolean; status: number }> = async () => ({ ok: true, status: 200 })) {
    const fetch = vi.fn(async (_input: string, init: RequestInit) => {
      void init;
      return respond();
    });
    const instance = new IndexNowNotifier(KEY, async () => pages, { now: start, lookback: 60 * minute, fetch, endpoint: 'https://indexnow.test/indexnow' });
    const sent = () => fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)) as { host: string; urlList: string[] });
    return { instance, fetch, sent };
  }

  it('announces only pages changed since the last run, never undated ones', async () => {
    const pages = [
      { url: 'https://app.ujimora.com/' },
      { url: 'https://app.ujimora.com/c/old', lastmod: at(-120) },
      { url: 'https://app.ujimora.com/c/recent', lastmod: at(-10) },
      { url: 'https://ujimora.com/blog/new-post', lastmod: at(5) },
    ];
    const { instance, sent } = notifier(pages);
    expect(await instance.run(at(15))).toBe(2);
    expect(sent()).toEqual([
      expect.objectContaining({ host: 'app.ujimora.com', urlList: ['https://app.ujimora.com/c/recent'] }),
      expect.objectContaining({ host: 'ujimora.com', urlList: ['https://ujimora.com/blog/new-post'] }),
    ]);
  });

  it('does not announce the same change twice', async () => {
    const pages = [{ url: 'https://app.ujimora.com/c/recent', lastmod: at(-10) }];
    const { instance, fetch } = notifier(pages);
    await instance.run(at(15));
    expect(await instance.run(at(30))).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    pages.push({ url: 'https://app.ujimora.com/c/later', lastmod: at(35) });
    expect(await instance.run(at(45))).toBe(1);
  });

  it('retries a submission the engine did not accept', async () => {
    let status = 429;
    const { instance, fetch } = notifier([{ url: 'https://app.ujimora.com/c/recent', lastmod: at(-10) }], async () => ({ ok: status < 300, status }));
    expect(await instance.run(at(15))).toBe(0);
    status = 202;
    expect(await instance.run(at(30))).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries after a network failure', async () => {
    let fail = true;
    const { instance } = notifier([{ url: 'https://app.ujimora.com/c/recent', lastmod: at(-10) }], async () => {
      if (fail) throw new Error('network down');
      return { ok: true, status: 200 };
    });
    expect(await instance.run(at(15))).toBe(0);
    fail = false;
    expect(await instance.run(at(30))).toBe(1);
  });

  it('posts JSON to the endpoint', async () => {
    const { instance, fetch } = notifier([{ url: 'https://app.ujimora.com/c/recent', lastmod: at(-10) }]);
    await instance.run(at(15));
    const [endpoint, init] = fetch.mock.calls[0];
    expect(endpoint).toBe('https://indexnow.test/indexnow');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ host: 'app.ujimora.com', key: KEY, keyLocation: `https://app.ujimora.com/${KEY}.txt`, urlList: ['https://app.ujimora.com/c/recent'] });
  });
});

describe('the production IndexNow key', () => {
  it('is served by both sites, so engines can verify it', () => {
    const blueprint = readFileSync(join(repoRoot, 'render.yaml'), 'utf8');
    const key = blueprint.match(/- key: INDEXNOW_KEY\n(?:\s*#.*\n)*\s*value: "([^"]+)"/)?.[1];
    expect(key).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    for (const site of ['apps/web/public', 'apps/marketing/public']) {
      expect(readFileSync(join(repoRoot, site, `${key}.txt`), 'utf8').trim(), site).toBe(key);
    }
    expect(blueprint).toMatch(/- key: INDEXNOW_ENABLED\n(?:\s*#.*\n)*\s*value: "true"\n/);
  });
});
