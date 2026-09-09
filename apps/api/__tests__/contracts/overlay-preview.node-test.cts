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
