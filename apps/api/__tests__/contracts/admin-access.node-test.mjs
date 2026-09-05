import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import rbacRoutes from '../../src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts';
import roleMiddleware from '../../src/infrastructure/adapters/inbound/middleware/requireRole.ts';

const { createRbacRoutes } = rbacRoutes;
const { requireAdmin } = roleMiddleware;

// Exercise the policy after authentication, without issuing real account tokens.
function appFor(role) {
  const app = express();
  const authenticated = (req, _res, next) => {
    req.userRole = role;
    req.userId = 'test-user';
    next();
  };
  app.use('/rbac', createRbacRoutes(authenticated));
  app.get('/admin', authenticated, requireAdmin, (_req, res) => res.sendStatus(204));
  app.use((error, _req, res, _next) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  return app;
}

test('admin can view roles and update payment providers', async () => {
  const app = appFor('admin');
  const response = await request(app).get('/rbac/me').expect(200);
  assert.ok(response.body.data.permissions.includes('roles:read'));
  assert.ok(response.body.data.permissions.includes('payment_providers:update'));
  await request(app).get('/admin').expect(204);
});

test('regular users cannot access admin controls', async () => {
  const app = appFor('user');
  const response = await request(app).get('/rbac/me').expect(200);
  assert.ok(!response.body.data.permissions.includes('roles:read'));
  assert.ok(!response.body.data.permissions.includes('payment_providers:update'));
  await request(app).get('/admin').expect(403);
});

test('unknown roles receive no permissions', async () => {
  const response = await request(appFor('unknown')).get('/rbac/me').expect(200);
  assert.deepEqual(response.body.data.permissions, []);
});
