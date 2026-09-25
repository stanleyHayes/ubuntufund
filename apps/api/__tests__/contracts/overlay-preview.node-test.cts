const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { OVERLAY_PAGE_HTML } = require('../../src/infrastructure/adapters/inbound/http/views/overlayPage.ts');
test('overlay preview escapes titles and never contacts live session endpoints', () => {
  for (const design of ['forest', 'ivory', 'compact', 'invalid']) {
    const dom = new JSDOM(OVERLAY_PAGE_HTML, { url: `https://example.test/live-sessions/preview/overlay/view?preview=1&design=${design}&title=%3Cscript%3Ehello%3C%2Fscript%3E&raised=50&goal=100`, runScripts: 'dangerously', beforeParse(window: any) { window.fetch = () => { throw new Error('Preview must not fetch'); }; window.EventSource = () => { throw new Error('Preview must not connect'); }; } });
    const doc = dom.window.document;
    assert.equal(doc.getElementById('panel').hidden, false);
    assert.equal(doc.getElementById('title').textContent, '<script>hello</script>');
    assert.equal(doc.getElementById('title').children.length, 0);
    assert.equal(doc.getElementById('pct').textContent, '50%');
    dom.window.close();
  }
});
test('overlay shows the host\'s session goal, with progress only while amounts are visible', async () => {
  const preview = new JSDOM(OVERLAY_PAGE_HTML, { url: 'https://example.test/live-sessions/preview/overlay/view?preview=1&title=Stream&raised=50&goal=100&target=2000', runScripts: 'dangerously', beforeParse(window: any) { window.fetch = () => { throw new Error('Preview must not fetch'); }; window.EventSource = () => { throw new Error('Preview must not connect'); }; } });
  assert.equal(preview.window.document.getElementById('sessionGoalWrap').hidden, false);
  assert.match(preview.window.document.getElementById('sessionGoal').textContent, /2,?000 · 0%$/);
  preview.window.close();
  const noGoal = new JSDOM(OVERLAY_PAGE_HTML, { url: 'https://example.test/live-sessions/preview/overlay/view?preview=1&title=Stream&raised=50&goal=100', runScripts: 'dangerously', beforeParse(window: any) { window.fetch = () => { throw new Error('Preview must not fetch'); }; window.EventSource = () => { throw new Error('Preview must not connect'); }; } });
  assert.equal(noGoal.window.document.getElementById('sessionGoalWrap').hidden, true);
  noGoal.window.close();
  for (const [amountRaised, expected] of [[100, /400 · 25%$/], [null, /400$/]] as const) {
    const live = new JSDOM(OVERLAY_PAGE_HTML, { url: 'https://example.test/api/v1/live-sessions/abc/overlay/view?token=t', runScripts: 'dangerously', beforeParse(window: any) {
      window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { status: 'active', title: 'Live', targetAmount: 400, campaignRaisedAmount: 100, campaignGoalAmount: 1000, config: {}, totals: { amountRaised, successfulDonations: 1 } } }) });
      window.EventSource = class { addEventListener() {} close() {} };
    } });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(live.window.document.getElementById('sessionGoalWrap').hidden, false);
    assert.match(live.window.document.getElementById('sessionGoal').textContent, expected);
    live.window.close();
  }
});
