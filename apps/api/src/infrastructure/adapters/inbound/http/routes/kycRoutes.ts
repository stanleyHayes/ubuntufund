import { Router } from 'express';
import { z } from 'zod';
import type { KYCController } from '../controllers/KYCController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

const DOCUMENT_TYPES = [
  'id_card',
  'passport',
  'drivers_license',
  'utility_bill',
  'bank_statement',
  'business_registration',
  'tax_certificate',
] as const;

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
});

const personalInfoSchema = z.object({
  fullName: z.string().max(200).optional(),
  dateOfBirth: z.string().datetime().optional(),
  nationality: z.string().max(100).optional(),
  idNumber: z.string().max(100).optional(),
  address: addressSchema.optional(),
});

const documentInputSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  url: z.string().min(1).max(2000),
});

const submitIdentitySchema = z.object({
  personalInfo: personalInfoSchema.optional(),
  documents: z.array(documentInputSchema).default([]),
});

const approveSchema = z.object({
  reviewNotes: z.string().max(2000).optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().max(1000).optional(),
  reviewNotes: z.string().max(2000).optional(),
});

export function createKYCRoutes(
  controller: KYCController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: ReturnType<typeof requireRole>
): Router {
  const router = Router();

  // User-facing endpoints
  router.post(
    '/identity',
    authMiddleware,
    validate(submitIdentitySchema),
    controller.submitIdentity
  );
  router.get('/status', authMiddleware, controller.getStatus);

  // Admin-only endpoints (registered after the literal segments above so
  // '/:id/approve' never swallows '/identity' or '/status').
  router.get('/pending', authMiddleware, requireAdmin, controller.listPending);
  router.put(
    '/:id/approve',
    authMiddleware,
    requireAdmin,
    validate(approveSchema),
    controller.approve
  );
  router.put(
    '/:id/reject',
    authMiddleware,
    requireAdmin,
    validate(rejectSchema),
    controller.reject
  );

  return router;
}
