import { Router } from 'express';
import { z } from 'zod';
import { CollaboratorRole } from '@ubuntu-fund/types';
import type { CollaborationController } from '../controllers/CollaborationController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const inviteCollaboratorSchema = z.object({
  userEmail: z.string().email(),
  role: z.nativeEnum(CollaboratorRole),
  revenueSharePercent: z.number().min(0).max(100),
  inviteMessage: z.string().max(1000).optional(),
});

// NOTE: These endpoints extend the /campaigns resource (POST
// /campaigns/:id/collaborators/invite, DELETE
// /campaigns/:id/collaborators/:collaboratorId, GET
// /campaigns/:id/collaborators). Since campaignRoutes.ts is an existing file
// outside this slice, this router is mounted separately at the same
// '/campaigns' base path (see the mount descriptor returned by this task)
// rather than added to campaignRoutes.ts.
export function createCampaignCollaboratorRoutes(
  controller: CollaborationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  optionalAuthMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  // Public, but owner-aware: with a valid token the campaign owner also sees
  // pending invitations (ListCampaignCollaboratorsUseCase filters by requester).
  router.get('/:id/collaborators', optionalAuthMiddleware, controller.listForCampaign);

  router.post(
    '/:id/collaborators/invite',
    authMiddleware,
    validate(inviteCollaboratorSchema),
    controller.invite
  );

  router.delete(
    '/:id/collaborators/:collaboratorId',
    authMiddleware,
    controller.remove
  );

  return router;
}
