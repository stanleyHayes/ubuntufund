import { Router } from 'express';
import { z } from 'zod';
import type { UploadController } from '../controllers/UploadController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const signUploadSchema = z.object({
  folder: z.string().max(200).optional(),
});

/**
 * Media upload routes mounted at `/uploads`.
 *   POST /uploads/sign — authenticated; returns Cloudinary direct-upload params
 *   (or a 501 when the server has no Cloudinary credentials configured).
 */
export function createUploadRoutes(
  controller: UploadController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/sign',
    authMiddleware,
    validate(signUploadSchema),
    controller.sign
  );

  return router;
}
