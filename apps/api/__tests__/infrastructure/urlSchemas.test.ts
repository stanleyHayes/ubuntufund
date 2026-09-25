import { describe, expect, it } from 'vitest';
import '../helpers/testApp.js';
import { isPlatformMediaUrl, platformMediaUrl, webAddress } from '../../src/infrastructure/adapters/inbound/http/routes/urlSchemas.js';
import { platformMediaUrl as uploadedUrl } from '../helpers/platformMedia.js';

describe('webAddress', () => {
  it.each(['https://myorg.org', 'http://myorg.org/about', '  https://myorg.org  '])('accepts %s', (value) => {
    expect(webAddress.safeParse(value).success).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'ftp://myorg.org',
    'myorg.org',
    'https://user:secret@myorg.org',
    `https://${'a'.repeat(500)}.org`,
  ])('rejects %s', (value) => {
    expect(webAddress.safeParse(value).success).toBe(false);
  });
});

describe('platform media URLs', () => {
  const cloud = 'ujimora-cloud';

  it('accepts what POST /uploads/image returns for this cloud', () => {
    expect(isPlatformMediaUrl(`https://res.cloudinary.com/${cloud}/image/upload/v1712/ujimora/profiles/a.png`, cloud)).toBe(true);
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:image/png;base64,AAAA'],
    ['http://evil.example/a.png'],
    ['https://evil.example/ujimora-cloud/image/upload/a.png'],
    ['http://res.cloudinary.com/ujimora-cloud/image/upload/a.png'],
    ['https://res.cloudinary.com/other-cloud/image/upload/a.png'],
    ['https://res.cloudinary.com/ujimora-cloud/image/authenticated/a.png'],
    ['https://res.cloudinary.com/ujimora-cloud/raw/upload/a.pdf'],
    ['https://user:pw@res.cloudinary.com/ujimora-cloud/image/upload/a.png'],
    ['https://res.cloudinary.com:8443/ujimora-cloud/image/upload/a.png'],
    [' https://res.cloudinary.com/ujimora-cloud/image/upload/a.png'],
  ])('rejects %s', (value) => {
    expect(isPlatformMediaUrl(value, cloud)).toBe(false);
  });

  it('accepts nothing when no Cloudinary cloud is configured', () => {
    expect(isPlatformMediaUrl('https://res.cloudinary.com//image/upload/a.png', '')).toBe(false);
  });

  it('validates against the configured cloud in the zod schema', () => {
    expect(platformMediaUrl.safeParse(uploadedUrl('a.png')).success).toBe(true);
    expect(platformMediaUrl.safeParse('https://example.com/a.png').success).toBe(false);
  });
});
