import { Router } from 'express';
import { z } from 'zod';
import type { AuthController } from '../controllers/AuthController.js';
import { validate } from '../../middleware/validate.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  country: z.string().min(2).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post('/register', validate(registerSchema), controller.register);
  router.post('/login', validate(loginSchema), controller.login);
  router.post(
    '/refresh',
    validate(refreshTokenSchema),
    controller.refreshToken
  );

  return router;
}
