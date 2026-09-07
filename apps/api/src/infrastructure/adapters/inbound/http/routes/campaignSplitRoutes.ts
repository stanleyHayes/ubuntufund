import { Router } from 'express';
import { z } from 'zod';
import type { CampaignSplitController } from '../controllers/CampaignSplitController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const createSplitSchema = z.object({
  allocations: z
    .array(
      z.object({
        beneficiaryId: z.string().min(1).max(100).optional(),
        name: z.string().min(1).max(200),
        email: z.string().email().max(200).optional(),
        shareBps: z.number().int().positive().max(10000),
      })
    )
    .min(2)
    .max(50),
});

const consentSchema = z.object({
  beneficiaryId: z.string().min(1).max(100),
  status: z.enum(['accepted', 'declined']),
});

/**
 * Split-proceeds routes composed onto the /campaigns resource (spec §17):
 *   GET  /campaigns/:id/split                     → active-split disclosure (public)
 *   POST /campaigns/:id/split                      → create a draft version (owner)
 *   GET  /campaigns/:id/split/versions             → all versions (owner/admin)
 *   POST /campaigns/:id/split/:version/consent     → record a beneficiary's consent
 *   POST /campaigns/:id/split/:version/activate    → activate a consented version
 */
export function createCampaignSplitRoutes(
  splitController: CampaignSplitController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/:id/split', splitController.getDisclosure);
  router.post(
    '/:id/split',
    authMiddleware,
    validate(createSplitSchema),
    splitController.createSplit
  );
  router.get('/:id/split/versions', authMiddleware, splitController.listVersions);
  router.post(
    '/:id/split/:version/consent',
    authMiddleware,
    validate(consentSchema),
    splitController.setConsent
  );
  router.post(
    '/:id/split/:version/activate',
    authMiddleware,
    splitController.activate
  );

  return router;
}
