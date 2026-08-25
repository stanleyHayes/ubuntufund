import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ShortLinkModel } from '../../src/infrastructure/database/models/ShortLinkModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

/**
 * superagent only fills `res.text` for text/* responses; the QR endpoints send
 * binary-ish content types (image/svg+xml, image/png), so buffer the raw body.
 */
function binaryParser(
  res: request.Response,
  cb: (err: Error | null, body: Buffer) => void
): void {
  const chunks: Buffer[] = [];
  const stream = res as unknown as NodeJS.ReadableStream;
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk as Buffer)));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
}

function campaignPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Clean Water For All',
    description: 'A campaign to bring clean water to rural communities in need.',
    goalAmount: 5000,
    currency: 'GHS',
    category: CampaignCategory.COMMUNITY,
    priority: CampaignPriority.NORMAL,
    beneficiaries: ['Test Beneficiary'],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function setVerificationLevel(userId: string, level: number): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: level });
}

async function createCampaign(
  app: Express,
  token: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send(campaignPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data as { id: string; slug?: string };
}

describe('Vanity slugs, short links & dynamic QR', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('slugs', () => {
    it('auto-generates a kebab-case slug from the title on create', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('slug'));
      await setVerificationLevel(userId, 2);

      const campaign = await createCampaign(app, token, {
        title: 'Help Rebuild The Village School',
      });

      expect(campaign.slug).toBe('help-rebuild-the-village-school');
    });

    it('dedupes slugs generated from identical titles', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('dupe'));
      await setVerificationLevel(userId, 3);

      const first = await createCampaign(app, token, { title: 'Same Title Here' });
      const second = await createCampaign(app, token, { title: 'Same Title Here' });

      expect(first.slug).toBe('same-title-here');
      expect(second.slug).not.toBe(first.slug);
      expect(second.slug).toMatch(/^same-title-here-[a-z0-9]+$/);
    });

    it('serves the public-by-slug view with a social preview block', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('bySlug'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token, {
        title: 'Solar Panels For The Clinic',
      });

      const res = await request(app).get(
        `/api/v1/campaigns/slug/${campaign.slug}/public`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(campaign.id);
      expect(res.body.data.slug).toBe('solar-panels-for-the-clinic');
      expect(res.body.data.socialPreview).toMatchObject({
        title: 'Solar Panels For The Clinic',
        goalAmount: 5000,
        currency: 'GHS',
      });
      expect(res.body.data.socialPreview.canonicalUrl).toContain(
        '/c/solar-panels-for-the-clinic'
      );
      expect(typeof res.body.data.socialPreview.summary).toBe('string');
    });

    it('returns 404 for an unknown slug', async () => {
      const res = await request(app).get(
        '/api/v1/campaigns/slug/no-such-campaign-xyz/public'
      );
      expect(res.status).toBe(404);
    });

    it('lets the owner set a custom slug', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('custom'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaign.id}/slug`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'my-custom-handle' });

      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe('my-custom-handle');

      const fetched = await request(app).get(
        '/api/v1/campaigns/slug/my-custom-handle/public'
      );
      expect(fetched.status).toBe(200);
      expect(fetched.body.data.id).toBe(campaign.id);
    });

    it('rejects a reserved slug with 409', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('reserved'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaign.id}/slug`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'admin' });

      expect(res.status).toBe(409);
    });

    it('rejects a duplicate slug with 409', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('taken'));
      await setVerificationLevel(userId, 3);
      const a = await createCampaign(app, token);
      const b = await createCampaign(app, token);

      await request(app)
        .patch(`/api/v1/campaigns/${a.id}/slug`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'the-one-true-handle' })
        .expect(200);

      const res = await request(app)
        .patch(`/api/v1/campaigns/${b.id}/slug`)
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'the-one-true-handle' });

      expect(res.status).toBe(409);
    });

    it('forbids a non-owner from setting the slug', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('owner'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const { token: otherToken } = await registerUser(app, uniqueEmail('intruder'));

      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaign.id}/slug`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ slug: 'stolen-handle' });

      expect(res.status).toBe(403);
    });
  });

  describe('short links & QR codes', () => {
    it('creates a campaign QR code and returns short URL + rendered QR', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('qr'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token, {
        title: 'Feed The Neighborhood',
      });

      const res = await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'campaign' });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toEqual(expect.any(String));
      expect(res.body.data.shortUrl).toContain(`/r/${res.body.data.code}`);
      expect(res.body.data.target).toContain('/c/feed-the-neighborhood');
      expect(res.body.data.pngDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(res.body.data.svg).toContain('<svg');
    });

    it('builds an amount-preset donate target', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('amt'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const res = await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'amount', presetAmount: 50 });

      expect(res.status).toBe(201);
      expect(res.body.data.target).toContain('/donate?amount=50');
    });

    it('forbids a non-owner from creating a QR code', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('qrowner'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const { token: otherToken } = await registerUser(app, uniqueEmail('qrother'));

      const res = await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ kind: 'campaign' });

      expect(res.status).toBe(403);
    });

    it('lists a campaign QR codes for the owner', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('qrlist'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'campaign' })
        .expect(201);
      await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'live' })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].shortUrl).toContain('/r/');
    });

    it('redirects /r/:code, records a scan, and forwards utm', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('redir'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token, {
        title: 'Redirect Me Please',
      });

      const create = await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'campaign' })
        .expect(201);
      const code = create.body.data.code as string;

      const res = await request(app)
        .get(`/r/${code}?utm_source=flyer`)
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/c/redirect-me-please');
      expect(res.headers.location).toContain('utm_source=flyer');
      expect(res.headers['x-short-url']).toContain(`/r/${code}`);

      const stored = await ShortLinkModel.findOne({ code });
      expect(stored?.scanCount).toBe(1);
      expect(stored?.scans[0]?.source).toBe('flyer');
    });

    it('renders public SVG and PNG QR endpoints', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('render'));
      await setVerificationLevel(userId, 2);
      const campaign = await createCampaign(app, token);

      const create = await request(app)
        .post(`/api/v1/campaigns/${campaign.id}/qr-codes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'campaign' })
        .expect(201);
      const code = create.body.data.code as string;

      const svg = await request(app)
        .get(`/qr/${code}.svg`)
        .buffer(true)
        .parse(binaryParser);
      expect(svg.status).toBe(200);
      expect(svg.headers['content-type']).toContain('image/svg+xml');
      expect((svg.body as Buffer).toString('utf8')).toContain('<svg');

      const png = await request(app)
        .get(`/qr/${code}.png`)
        .buffer(true)
        .parse(binaryParser);
      expect(png.status).toBe(200);
      expect(png.headers['content-type']).toContain('image/png');
      expect(Buffer.isBuffer(png.body)).toBe(true);
      expect((png.body as Buffer).length).toBeGreaterThan(0);
    });

    it('404s an unknown short code on redirect and render', async () => {
      await request(app).get('/r/nope999').redirects(0).expect(404);
      await request(app).get('/qr/nope999.svg').expect(404);
      await request(app).get('/qr/nope999.png').expect(404);
    });
  });
});
