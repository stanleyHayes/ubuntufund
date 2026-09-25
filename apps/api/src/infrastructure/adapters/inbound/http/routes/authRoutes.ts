import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
import { webAddress } from './urlSchemas.js';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { OrganizationType, UserRole } from '@ubuntu-fund/types';
import type { AuthController } from '../controllers/AuthController.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

/**
 * Account emails are stored trimmed and lower-cased. Normalise the input the
 * same way before validating: phone keyboards (iOS autocomplete in particular)
 * append a trailing space, which used to fail `.email()` with an opaque 400.
 * Only effective on routes that apply the parsed body (validate(..., { apply: true })).
 */
const accountEmail = z.string().trim().toLowerCase().email();

const registerSchema = z
  .object({
    legalAcceptance: legalAcceptanceSchema,
    email: accountEmail,
    password: z.string().min(8).max(128),
    name: z.string().trim().min(2).max(100),
    country: z.string().min(2).max(100).optional(),
    role: z.enum([UserRole.USER, UserRole.ORGANIZATION]).optional(),
    organizationName: z.string().min(2).max(160).optional(),
    organizationType: z.nativeEnum(OrganizationType).optional(),
    registrationNumber: z.string().max(100).optional(),
    website: webAddress.optional(),
    needsWebsite: z.boolean().optional(),
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
  mfaCode: z.string().trim().min(6).max(64).optional(),
  email: accountEmail,
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
  email: accountEmail,
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
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  // These schemas declare every field their handlers read, so they apply the
  // parsed (trimmed, normalised) body. Passwords are never trimmed.
  router.post('/register', authRateLimiter, validate(registerSchema, { apply: true }), controller.register);
  router.post('/login', authRateLimiter, validate(loginSchema, { apply: true }), controller.login);
  router.post(
    '/refresh',
    validate(refreshTokenSchema),
    controller.refreshToken
  );
  router.post(
    '/forgot-password',
    authRateLimiter,
    validate(forgotPasswordSchema, { apply: true }),
    controller.forgotPassword
  );
  router.post(
    '/reset-password',
    authRateLimiter,
    validate(resetPasswordSchema, { apply: true }),
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
