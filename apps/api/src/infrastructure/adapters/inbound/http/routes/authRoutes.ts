import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthController } from '../controllers/AuthController.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export function createAuthRoutes(
  controller: AuthController,
  authMiddleware?: RequestHandler
): Router {
  const router = Router();

  router.post('/register', authRateLimiter, validate(registerSchema), controller.register);
  router.post('/login', authRateLimiter, validate(loginSchema), controller.login);
  router.post(
    '/refresh',
    validate(refreshTokenSchema),
    controller.refreshToken
  );
  router.post(
    '/forgot-password',
    authRateLimiter,
    validate(forgotPasswordSchema),
    controller.forgotPassword
  );
  router.post(
    '/reset-password',
    authRateLimiter,
    validate(resetPasswordSchema),
    controller.resetPassword
  );
  if (authMiddleware) {
    router.put(
      '/change-password',
      authMiddleware,
      validate(changePasswordSchema),
      controller.changePassword
    );
  }

  return router;
}
