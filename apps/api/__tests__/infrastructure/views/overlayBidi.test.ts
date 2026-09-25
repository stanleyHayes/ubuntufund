import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { OVERLAY_PAGE_HTML } from '../../../src/infrastructure/adapters/inbound/http/views/overlayPage.js';

/**
 * Donor names, messages and campaign titles are shown on stream overlays.
 * Without bidi isolation a right-to-left name (or one carrying U+202E) laid
 * out inside a left-to-right paragraph and reordered the " · GH₵ amount"
 * next to it.
 */
it('isolates donor names, messages and the title from surrounding text direction', () => {
  const listeners: Record<string, (event: { data: string }) => void> = {};
  const dom = new JSDOM(OVERLAY_PAGE_HTML, {
    url: 'https://api.example.test/api/v1/live-sessions/abc/overlay/view?token=t',
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.assign(window, {
        fetch: () => new Promise(() => {}),
        EventSource: class { addEventListener(type: string, fn: (event: { data: string }) => void) { listeners[type] = fn; } close() {} },
      });
    },
  });
  const doc = dom.window.document;
  expect(doc.getElementById('title')!.getAttribute('dir')).toBe('auto');

  listeners.donation({ data: JSON.stringify({ name: 'محمد‮', amount: 50, message: 'بالتوفيق' }) });
  const alert = doc.querySelector('.alert')!;
  const name = alert.querySelector('.who > bdi')!;
  expect(name.textContent).toBe('محمد‮');
  expect(alert.querySelector('.who .amt')!.textContent).toContain('50');
  // The amount sits outside the isolate, so the name cannot reorder it.
  expect(name.contains(alert.querySelector('.who .amt'))).toBe(false);
  expect((alert.querySelector('.msg') as HTMLElement).dir).toBe('auto');
  expect(OVERLAY_PAGE_HTML).toContain('unicode-bidi: isolate');
  dom.window.close();
});
