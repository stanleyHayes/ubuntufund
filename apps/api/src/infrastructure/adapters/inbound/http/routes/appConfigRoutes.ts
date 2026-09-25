import { Router } from 'express';
import type { MobileAppConfig } from '../../../../config/mobileApp.js';

/**
 * Public, unauthenticated native-app policy (minimum supported version and
 * store links). Mobile checks it at launch and on resume; web ignores it.
 */
export function createAppConfigRoutes(config: MobileAppConfig): Router {
  const router = Router();
  router.get('/config', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ data: config, message: 'App config', status: 200 });
  });
  return router;
}
