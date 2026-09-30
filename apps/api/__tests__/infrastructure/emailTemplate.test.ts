import { expect, it } from 'vitest';
import { escapeHtml, renderEmail, safeHref } from '../../src/infrastructure/adapters/outbound/emailTemplate.js';

const brand = { webUrl: 'https://app.example.test/', supportEmail: 'support@example.test' };

it('renders one message as branded HTML and matching plain text', () => {
  const { html, text } = renderEmail({
    preheader: 'Confirm this address.',
    eyebrow: 'Your account',
    heading: 'Confirm your email address',
    intro: ['First line\nsecond line'],
    details: [{ label: 'Reference', value: 'abc123' }],
    button: { label: 'Verify my email', url: 'https://app.example.test/verify-email#token=ff00' },
    showLinkFallback: true,
    after: ['This link expires in 30 minutes.'],
    footer: ['You received this because this address was entered on Ujimora.'],
    footerLinks: [{ label: 'Change your email choices', url: 'https://app.example.test/settings' }],
  }, brand);
  // A real, clickable button and a plain link for clients that block buttons.
  expect(html.match(/href="https:\/\/app\.example\.test\/verify-email#token=ff00"/g)).toHaveLength(2);
  expect(html).toContain('Verify my email');
  expect(html).toContain('First line<br>second line');
  expect(html).toContain('src="https://app.example.test/favicon-192x192.png"');
  expect(html).toContain('prefers-color-scheme:dark');
  expect(html).toContain('href="mailto:support@example.test"');
  // No third-party requests when the email is opened.
  expect(html).not.toMatch(/fonts\.googleapis|<link /);
  // The text part carries the same content and every link.
  expect(text).toContain('Confirm your email address');
  expect(text).toContain('Verify my email: https://app.example.test/verify-email#token=ff00');
  expect(text).toContain('Reference: abc123');
  expect(text).toContain('Change your email choices: https://app.example.test/settings');
  expect(text).toContain('Support: support@example.test');
});

it('escapes every dynamic value and only links to http(s) and mailto', () => {
  const { html } = renderEmail({
    preheader: '<b>hi</b>',
    heading: 'Hello <script>alert(1)</script>',
    message: { body: '<img src=x onerror="alert(1)">', signature: '"Ama" & co' },
    button: { label: 'Open', url: 'javascript:alert(1)' },
    footer: ['<i>x</i>'],
    footerLinks: [{ label: 'Bad', url: 'data:text/html,hi' }],
  }, brand);
  expect(html).not.toMatch(/<script|<img src=x|<b>hi|<i>x/);
  expect(html).toContain('Hello &lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).toContain('&quot;Ama&quot; &amp; co');
  expect(html).not.toMatch(/href="(javascript|data):/);
  expect(safeHref('https://ok.example/x?a=1&b=2')).toBe('https://ok.example/x?a=1&amp;b=2');
  expect(safeHref('mailto:a@b.test')).toBe('mailto:a@b.test');
  expect(safeHref('not a url')).toBe('#');
  expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

it('omits the plain link fallback unless asked, and never shows empty sections', () => {
  const { html, text } = renderEmail({ preheader: 'p', heading: 'Title', button: { label: 'See it', url: 'https://app.example.test/x' }, footer: [] }, { webUrl: 'https://app.example.test' });
  expect(html.match(/href="https:\/\/app\.example\.test\/x"/g)).toHaveLength(1);
  expect(html).not.toContain('Button not working?');
  expect(html).not.toContain('Questions?');
  expect(text).toBe('Title\n\nSee it: https://app.example.test/x');
});
