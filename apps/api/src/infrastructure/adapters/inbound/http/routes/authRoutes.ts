import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { OrganizationType, UserRole } from '@ubuntu-fund/types';
import type { AuthController } from '../controllers/AuthController.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(2).max(100),
    country: z.string().min(2).max(100).optional(),
    role: z.enum([UserRole.USER, UserRole.ORGANIZATION]).optional(),
    organizationName: z.string().min(2).max(160).optional(),
    organizationType: z.nativeEnum(OrganizationType).optional(),
    registrationNumber: z.string().max(100).optional(),
    website: z.string().url().max(500).optional(),
    referralCode: z.string().min(3).max(24).optional(),
  })
  .superRefine((value, context) => {
    if (value.role !== UserRole.ORGANIZATION) return;
    if (!value.organizationName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['organizationName'],
        message: 'Organization name is required',
      });
    }
    if (!value.organizationType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['organizationType'],
        message: 'Organization type is required',
      });
    }
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
